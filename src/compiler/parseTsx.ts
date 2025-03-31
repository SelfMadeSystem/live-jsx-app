import type * as m from 'monaco-editor';
import { getImportUrl, tryToAddTypingsToMonaco } from '../monaco/MonacoUtils';
import { abortSymbol } from './compilerResult';
import {
  JSXAttribute,
  Module,
  ModuleItem,
  Options,
  StringLiteral,
  TemplateLiteral,
  parse,
  transform,
} from '@swc/wasm-web';

/**
 * Recursively find all CSS class names in the AST.
 * This function traverses the AST and collects class names from
 * StringLiteral and TemplateLiteral nodes that are found within
 * JSXAttribute nodes with the name "className".
 */
function findCssClassList(
  body:
    | (unknown | StringLiteral | TemplateLiteral | JSXAttribute | undefined)[]
    | undefined,
  classNames: Set<string> = new Set(),
  traversed = new Set(),
  frFind = false,
): Set<string> {
  if (!body) return classNames;
  for (const item of body) {
    if (!item || typeof item !== 'object') continue;
    if (traversed.has(item)) continue;
    traversed.add(item);
    if ('type' in item) {
      if (item.type === 'JSXAttribute') {
        const jsxItem = item as JSXAttribute;
        if (
          jsxItem.name.type === 'Identifier' &&
          jsxItem.name.value === 'className'
        ) {
          findCssClassList([jsxItem.value], classNames, traversed, true);
        }
      } else if (frFind) {
        if (item.type === 'StringLiteral') {
          for (const className of (item as StringLiteral).value
            .split(' ')
            .map(c => c.trim())
            .filter(Boolean)) {
            classNames.add(className);
          }
        } else if (item.type === 'TemplateLiteral') {
          for (const className of (item as TemplateLiteral).quasis
            .map(q => q.raw)
            .join(' ')
            .split(' ')
            .map(c => c.trim())
            .filter(Boolean)) {
            classNames.add(className);
          }
        }
      }
    }
    for (const key in item) {
      const value = item[key as keyof typeof item];
      if (Array.isArray(value)) {
        findCssClassList(value, classNames, traversed, frFind);
      } else if (value && typeof value === 'object') {
        findCssClassList([value], classNames, traversed, frFind);
      }
    }
  }

  return classNames;
}

const TRANSFORM_PARAMS: Options = {
  jsc: {
    target: 'es2020',
    parser: {
      syntax: 'typescript',
      tsx: true,
      decorators: true,
      dynamicImport: true,
    },
    transform: {
      react: {
        runtime: 'automatic',
      },
    },
  },
};

export type TsxCompilerResult = {
  code?: string;
  parsedModule?: Module;
  classList?: Set<string>;
  errors?: string[];
  warnings?: string[];
} & (
  | {
      code: string;
      parsedModule: Module;
      classList: Set<string>;
    }
  | {
      errors: string[];
    }
  | {
      warnings: string[];
    }
);

export type TypeScriptFile = {
  /** The name of the file. */
  filename: string;
  /** The new contents of the file. */
  newContents: string;
  /** The original contents of the file. */
  contents: string;
  /** The built JavaScript code. */
  builtJs: string;
  /** The parsed module */
  module: Module | null;
  /** Whether the file was successfully compiled. */
  success: boolean;
  /** The transformed JavaScript code after applying `@property` and import transformations. */
  transformedJs: string;
  /** The generated object URL of this file */
  objectUrl: string;
  /** The list of CSS classes found in the file. */
  classList: string[];
};

export type TsxCompilerOptions = {
  signal?: AbortSignal;
};

export async function compileTsx(
  code: string,
  options: TsxCompilerOptions,
): Promise<TsxCompilerResult> {
  const result = await parse(code, {
    syntax: 'typescript',
    tsx: true,
    decorators: true,
    dynamicImport: true,
    target: 'es2020',
  }).catch(e => {
    return { error: e };
  });

  if (options?.signal?.aborted) {
    throw abortSymbol;
  }

  if ('error' in result) {
    return {
      errors: [result.error],
    };
  }

  const classList = findCssClassList(result.body);

  const transformed = await transform(result, TRANSFORM_PARAMS).catch(e => {
    return { error: e };
  });

  if (options?.signal?.aborted) {
    throw abortSymbol;
  }

  if ('error' in transformed) {
    return {
      errors: [transformed.error],
    };
  }

  return { code: transformed.code, parsedModule: result, classList };
}

export type JsTransformOptions = {
  importMap: Record<string, string>;
  setImportMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  monaco: typeof m;
  files: TypeScriptFile[];
  signal?: AbortSignal;
};

/**
 * Replaces any imports in the code with the corresponding URLs from the import map.
 */
async function replaceImports(
  body: ModuleItem[],
  options: JsTransformOptions,
): Promise<[string[], Record<string, string>]> {
  if (!body) return [[], options.importMap];
  const warnings: string[] = [];
  const { monaco } = options;
  let { importMap } = options;
  for (const item of body) {
    if (!item || typeof item !== 'object') continue;
    if ('type' in item) {
      if (item.type === 'ImportDeclaration') {
        const importItem = item;
        const importUrl = importItem.source.value;
        if (
          importUrl.startsWith('data:') ||
          importUrl.startsWith('blob:') ||
          importUrl.startsWith('http:') ||
          importUrl.startsWith('https:') ||
          importUrl.startsWith('file:')
        ) {
          // Don't change data, blob, http, https or file imports
          continue;
        }
        if (importUrl.startsWith('../')) {
          warnings.push(
            'This editor includes a very basic bundler and virtual filesystem. Only relative imports starting with "./" are supported.',
          );
          continue;
        }
        if (importUrl === './') {
          warnings.push('Invalid import: "./".');
          continue;
        }
        const isRelative =
          importUrl.startsWith('./') || importUrl.startsWith('../');
        const module = importUrl.split('/').pop();
        if (!module) continue;
        if (!isRelative && (module === 'react' || module === 'react-dom')) {
          // Don't change react imports
          continue;
        }
        let found = false;
        for (const key in importMap) {
          if (
            importUrl === key ||
            (!isRelative && importUrl.startsWith(`${key}/`))
          ) {
            const newUrl = importMap[key];
            importItem.source.value = importItem.source.value.replace(
              key,
              newUrl,
            );
            if (importItem.source.raw) {
              importItem.source.raw = importItem.source.raw.replace(
                key,
                newUrl,
              );
            }
            found = true;
            break;
          } else if (isRelative && importUrl.startsWith(`${key}/`)) {
            warnings.push(`Invalid import: "${importUrl}".`);
            found = true;
            break;
          }
        }

        if (!isRelative && !found) {
          if (
            await tryToAddTypingsToMonaco(monaco!, module, n => {
              if (typeof n === 'function') importMap = n(importMap);
              else importMap = n;
            }).catch(err => {
              console.error('Error adding typings:', err);
              alert(`Failed to add typings for ${module}. Please try again.`);
              return true;
            })
          ) {
            continue;
          }
          const url = getImportUrl(module).href;
          importItem.source.value = importItem.source.value.replace(
            module,
            url,
          );
          if (importItem.source.raw) {
            importItem.source.raw = importItem.source.raw.replace(module, url);
          }
        }
      }
      // I don't care about other types of imports for now
    }
  }

  return [warnings, importMap];
}

/**
 * Gets the relative imports from the body of a module.
 */
function getRelativeImports(body: ModuleItem[]): string[] {
  const imports: string[] = [];
  if (!body) return imports;
  for (const item of body) {
    if (!item || typeof item !== 'object') continue;
    if ('type' in item) {
      if (item.type === 'ImportDeclaration') {
        const importItem = item;
        const importUrl = importItem.source.value;
        // ignore `../`
        if (importUrl.startsWith('./')) {
          imports.push(importUrl.split('/')[1]);
        }
      }
    }
  }
  return imports;
}

/**
 * Builds an import graph from the files.
 */
function buildImportGraph(
  files: Pick<TypeScriptFile, 'filename' | 'module'>[],
): Record<string, string[]> {
  const graph: Record<string, string[]> = {};

  for (const file of files) {
    const body = file.module?.body;
    if (!body) continue;

    const relativeImports = getRelativeImports(body);
    graph[file.filename] = relativeImports
      .map(
        importName =>
          files.find(f => f.filename.endsWith(importName))?.filename || '',
      )
      .filter(Boolean);
  }

  return graph;
}

/**
 * Detects cycles in the import graph using DFS.
 */
function detectCycles(graph: Record<string, string[]>): boolean {
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(node: string): boolean {
    if (stack.has(node)) return true; // Cycle detected
    if (visited.has(node)) return false;

    visited.add(node);
    stack.add(node);

    for (const neighbor of graph[node] || []) {
      if (dfs(neighbor)) return true;
    }

    stack.delete(node);
    return false;
  }

  for (const node in graph) {
    if (dfs(node)) return true;
  }

  return false;
}

export type JsTransformResult = {
  code?: string;
  warnings?: string[];
  errors?: string[];
};

/**
 * Processes nodes in topological order.
 */
async function processImportGraph(
  mainModule: Module,
  files: Pick<TypeScriptFile, 'filename' | 'module' | 'objectUrl'>[],
  options: JsTransformOptions,
): Promise<JsTransformResult> {
  const warnings: string[] = [];
  const graph = buildImportGraph(files);

  if (detectCycles(graph)) {
    return {
      errors: ['Cycle detected in the import graph.'],
    };
  }

  const processed = new Set<string>();
  const importMap = { ...options.importMap };

  async function processNode(filename: string): Promise<void> {
    if (processed.has(filename)) return;

    const file = files.find(f => f.filename === filename);
    if (!file) return;

    // Process dependencies first
    for (const dependency of graph[filename] || []) {
      await processNode(dependency);
    }

    if (!file.module) {
      // If the module is not available, skip it
      return;
    }

    const module = JSON.parse(JSON.stringify(file.module)) as Module;

    // Replace imports
    const [warns, updatedImportMap] = await replaceImports(module.body, {
      ...options,
      importMap,
    });
    warnings.push(...warns);
    Object.assign(importMap, updatedImportMap);

    // Transform the body into JS
    const transformed = await transform(module, {
      jsc: {
        target: 'es2020',
        parser: {
          syntax: 'typescript',
          tsx: true,
          decorators: true,
          dynamicImport: true,
        },
        transform: {
          react: {
            runtime: 'automatic',
          },
        },
      },
    });

    if (filename === 'main') {
      return;
    }

    // Create an object URL
    const blob = new Blob([transformed.code], {
      type: 'application/javascript',
    });
    const objectUrl = URL.createObjectURL(blob);
    file.objectUrl = objectUrl;

    // Update the import map
    importMap['./' + filename] = objectUrl;
    importMap['./' + filename + '.js'] = objectUrl;
    importMap['./' + filename + '.ts'] = objectUrl;
    importMap['./' + filename + '.tsx'] = objectUrl;
    importMap['./' + filename + '.jsx'] = objectUrl;
    importMap['./' + filename + '.mjs'] = objectUrl;

    processed.add(filename);
  }

  // Process all nodes
  for (const filename in graph) {
    await processNode(filename);
  }

  options.setImportMap(importMap);

  // Process the main module
  mainModule = JSON.parse(JSON.stringify(mainModule));
  const mainBody = mainModule.body;
  await replaceImports(mainBody, {
    ...options,
    importMap,
  }).then(([warns]) => {
    warnings.push(...warns);
  });

  const transformed = await transform(mainModule, TRANSFORM_PARAMS).catch(e => {
    return { error: e };
  });
  if ('error' in transformed) {
    return {
      errors: [transformed.error],
    };
  }
  return {
    code: transformed.code,
    warnings,
  };
}

export async function transformJs(
  module: Module,
  options: JsTransformOptions,
): Promise<JsTransformResult> {
  if (options.signal?.aborted) {
    throw abortSymbol;
  }

  // FIXME: When deleting a file, the object URL is not revoked.
  for (const file of options.files) {
    if (file.objectUrl) {
      URL.revokeObjectURL(file.objectUrl);
    }
  }

  const files = options.files.map(file => ({
    filename: file.filename.replace(/\.tsx$/, ''),
    module: file.module,
    objectUrl: file.objectUrl,
  }));

  const graph = buildImportGraph(files);
  if (detectCycles(graph)) {
    return {
      errors: ['Cycle detected in the import graph.'],
    };
  }

  const transformed = await processImportGraph(module, files, options);
  if (options.signal?.aborted) {
    throw abortSymbol;
  }
  return transformed;
}
