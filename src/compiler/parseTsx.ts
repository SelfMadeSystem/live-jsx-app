import type * as m from 'monaco-editor';
import { getImportUrl, tryToAddTypingsToMonaco } from '../monaco/MonacoUtils';
import { abortSymbol } from './compilerResult';
import {
  JSXAttribute,
  ModuleItem,
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

/**
 * Replaces any imports in the code with the corresponding URLs from the import map.
 */
async function replaceImports(
  body: ModuleItem[],
  options: TsxCompilerOptions,
): Promise<void> {
  if (!body) return;
  const { importMap, setImportMap, monaco } = options;
  for (const item of body) {
    if (!item || typeof item !== 'object') continue;
    if ('type' in item) {
      if (item.type === 'ImportDeclaration') {
        const importItem = item;
        const importUrl = importItem.source.value;
        const module = importUrl.split('/').pop();
        if (!module) continue;
        if (module === 'react' || module === 'react-dom') {
          // Don't change react imports
          continue;
        }
        let found = false;
        for (const key in importMap) {
          if (importUrl === key || importUrl.startsWith(`${key}/`)) {
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
          }
        }

        if (!found) {
          if (
            await tryToAddTypingsToMonaco(monaco!, module, setImportMap).catch(
              err => {
                console.error('Error adding typings:', err);
                alert(`Failed to add typings for ${module}. Please try again.`);
                return true;
              },
            )
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
}

export type TsxCompilerResult = {
  code?: string;
  classList?: Set<string>;
  error?: string;
  warning?: string;
} & (
  | {
      code: string;
      classList: Set<string>;
    }
  | {
      error: string;
    }
  | {
      warning: string;
    }
);

export type TsxCompilerOptions = {
  importMap: Record<string, string>;
  setImportMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  monaco: typeof m;
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
    return result;
  }

  const classList = findCssClassList(result.body);
  await replaceImports(result.body, options);

  const transformed = await transform(result, {
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
  }).catch(e => {
    return { error: e };
  });

  if (options?.signal?.aborted) {
    throw abortSymbol;
  }

  if ('error' in transformed) {
    return transformed;
  }

  return { code: transformed.code, classList };
}
