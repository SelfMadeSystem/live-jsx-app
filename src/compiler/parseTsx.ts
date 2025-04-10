import * as esbuild from 'esbuild-wasm';
import * as m from 'monaco-editor';
import {
  getExtension,
  getImportUrl,
  tryToAddTypingsToMonaco,
} from '../monaco/MonacoUtils';
import { LiveFile, abortSymbol } from './compilerResult';

export type TsxCompilerResult = {
  code?: string;
  css?: string;
  classList?: Set<string>;
  errors?: string[];
  warnings?: string[];
} & (
  | {
      code: string;
      css: string;
      classList: Set<string>;
    }
  | {
      errors: string[];
    }
  | {
      warnings: string[];
    }
);

export type TsxCompilerOptions = {
  files: Record<string, LiveFile>;
  signal?: AbortSignal;
  importMap: Record<string, string>;
  setImportMap: (importMap: Record<string, string>) => void;
  monaco: typeof m;
};

function virtualNpmPlugin(
  importMap: Record<string, string>,
  setImportMap: (importMap: Record<string, string>) => void,
  monaco: typeof m,
): esbuild.Plugin {
  return {
    name: 'virtual-npm', // uses esm.sh internally. sorry esm.sh
    setup(build: esbuild.PluginBuild) {
      build.onResolve({ filter: /^[^./].*/ }, async args => {
        const moduleName = args.path;
        if (
          moduleName.startsWith('data:') ||
          moduleName.startsWith('blob:') ||
          moduleName.startsWith('http:') ||
          moduleName.startsWith('https:') ||
          moduleName.startsWith('file:') ||
          moduleName.startsWith('./') ||
          moduleName.startsWith('../') ||
          moduleName === 'react' ||
          moduleName === 'react-dom'
        ) {
          // Ignore these paths
          return null;
        }

        // Check if the module is already in the import map
        if (importMap[moduleName]) {
          return { path: importMap[moduleName], external: true };
        }

        // Dynamically add typings to monaco and update the import map
        try {
          const url = getImportUrl(moduleName).href;
          importMap[moduleName] = url;
          setImportMap(importMap);

          // Add typings to monaco
          await tryToAddTypingsToMonaco(monaco, moduleName, updatedMap => {
            if (typeof updatedMap === 'function') {
              setImportMap(updatedMap(importMap));
            } else {
              setImportMap(updatedMap);
            }
          });

          return { path: url, external: true };
        } catch (err) {
          console.error(`Failed to resolve module: ${moduleName}`, err);
          return null;
        }
      });
    },
  };
}

/**
 * Assumes `path` is a fs-like path (i.e. starts with `/`, `./`, or `../`).
 */
function getAbsoluteImportPath(importer: string, path: string): string {
  // Check if the path is already absolute
  if (path.startsWith('/')) {
    return path;
  }

  // Get the directory of the importer
  const importerDir = importer.split('/').slice(0, -1).join('/');
  // If the path is relative, resolve it against the importer's directory
  if (path.startsWith('./') || path.startsWith('../')) {
    return new URL(path, `file://${importerDir}/`).pathname.substring(1);
  }
  // Otherwise, return the path as is
  return path;
}

/**
 * Gets a list of strings to test import paths against.
 */
function getImportPathList(path: string): string[] {
  const filename = path;
  if (filename.includes('.')) {
    return [path];
  }
  return [
    `${path}.tsx`, // prefer typescript/react
    `${path}.ts`,
    `${path}.jsx`,
    `${path}.js`,
    path,
  ];
}

function getLoaderForFileExtension(extension: string): esbuild.Loader {
  switch (extension) {
    case '.ts':
    case '.tsx':
      return 'tsx';
    case '.js':
    case '.jsx':
      return 'jsx';
    case '.css':
      return 'css';
    default:
      return 'text';
  }
}

export async function compileTsx(
  code: string,
  options: TsxCompilerOptions,
): Promise<TsxCompilerResult> {
  const { files, signal, importMap, setImportMap, monaco } = options;

  // Check if the compilation was aborted
  if (signal?.aborted) {
    throw abortSymbol;
  }

  // Create a new Set to store unique class names
  const classList = new Set<string>();

  // Use esbuild to transform the code with the custom plugins
  const r = await esbuild
    .build({
      entryPoints: ['./main.tsx'],
      bundle: true,
      write: false,
      format: 'esm',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      external: ['react', 'react-dom'],
      outdir: 'out',
      plugins: [
        {
          name: 'virtual-file-system',
          setup(build: esbuild.PluginBuild) {
            // Handle main.tsx
            build.onResolve({ filter: /main\.tsx$/ }, args => {
              const { path } = args;
              if (path === './main.tsx') {
                return { path, namespace: 'virtual' };
              }
              return null;
            });
            build.onLoad({ filter: /main\.tsx$/, namespace: 'virtual' }, () => {
              return {
                contents: code,
                loader: 'tsx',
              };
            });

            // Handle file reads
            build.onResolve({ filter: /\.\/.*/ }, args => {
              const { path: importPath, importer } = args;
              const path = getAbsoluteImportPath(importer, importPath);

              // Ignore 'main.css' since it's automatically injected
              if (path === 'main.css') {
                return { path, namespace: 'ignored' };
              }

              const importPaths = getImportPathList(path);
              for (const importPath of importPaths) {
                if (importPath in files) {
                  return {
                    path: importPath,
                    namespace: 'virtual',
                  };
                }
              }

              // try importing it as <url>/vfs/<path>
              return {
                path: new URL(
                  `vfs/${path}`,
                  window.location.href,
                ).href,
                external: true,
              }
            });

            // Handle ignored files
            build.onLoad({ filter: /.*/, namespace: 'ignored' }, () => {
              return {
                contents: '',
                loader: 'text',
              };
            });

            // Handle file reads
            build.onLoad({ filter: /.*/, namespace: 'virtual' }, args => {
              const { path } = args;
              if (path in files) {
                const file = files[path];
                return {
                  contents: file.contents,
                  loader: getLoaderForFileExtension(getExtension(path)),
                };
              }
              return null;
            });
          },
        },
        virtualNpmPlugin(importMap, setImportMap, monaco), // Add the virtual-npm plugin
      ],
      tsconfigRaw: {
        compilerOptions: {
          target: 'esnext',
          module: 'esnext',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
    })
    .then(
      e => [e, null] as const,
      e => [null, e] as const,
    );

  if (options.signal?.aborted) {
    throw abortSymbol;
  }

  if (r[1]) {
    const err = r[1];
    console.error('Error during compilation:', err);
    return {
      errors: [err.message],
    };
  }
  const result = r[0]!;

  // Check if the compilation was aborted
  if (signal?.aborted) {
    throw abortSymbol;
  }

  // Extract class names from the transformed code
  const regex = /className: ["'`]([^"'`]+)["'`]/g;
  let match;
  while ((match = regex.exec(result.outputFiles[0].text)) !== null) {
    match[1].split(' ').forEach(className => classList.add(className));
  }

  let css = '';
  for (const file of result.outputFiles) {
    if (file.path.endsWith('.css')) {
      css += file.text;
    }
  }

  return {
    code: result.outputFiles[0].text,
    classList,
    css,
    warnings: result.warnings.map(w => w.text),
  };
}
