import * as esbuild from 'esbuild-wasm';
import * as m from 'monaco-editor';
import { abortSymbol } from './compilerResult';
import { getImportUrl, tryToAddTypingsToMonaco } from '../monaco/MonacoUtils';

export type TsxCompilerResult = {
  code?: string;
  classList?: Set<string>;
  errors?: string[];
  warnings?: string[];
} & (
  | {
      code: string;
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
  files: Record<string, TypeScriptFile>;
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
    name: 'virtual-npm', // uses skypack internally. sorry skypack
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
  const result = await esbuild.build({
    stdin: {
      contents: code,
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    format: 'esm',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    external: ['react', 'react-dom'],
    plugins: [
      {
        name: 'virtual-file-system',
        setup(build: esbuild.PluginBuild) {
          // Handle file reads
          build.onResolve({ filter: /\.\/.*/ }, args => {
            const { path } = args;
            const filename = path.split('/').pop()!;
            if (filename in files) {
              return {
                path,
                namespace: 'virtual',
              };
            }
            return null;
          });

          // Handle file reads
          build.onLoad({ filter: /.*/, namespace: 'virtual' }, args => {
            const { path } = args;
            const filename = path.split('/').pop()!;
            if (filename in files) {
              const file = files[filename];
              return {
                contents: file.newContents,
                loader: 'tsx',
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
  });

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

  return {
    code: result.outputFiles[0].text,
    classList,
  };
}
