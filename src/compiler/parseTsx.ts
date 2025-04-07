import * as esbuild from 'esbuild-wasm';
import { abortSymbol } from './compilerResult';

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
};

export async function compileTsx(
  code: string,
  options: TsxCompilerOptions,
): Promise<TsxCompilerResult> {
  const { files, signal } = options;

  // Check if the compilation was aborted
  if (signal?.aborted) {
    throw abortSymbol;
  }

  // Create a new Set to store unique class names
  const classList = new Set<string>();
  // Create a virtual file system for esbuild
  const fileSystemPlugin = {
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
  };

  // Use esbuild to transform the code with the custom plugin
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
    plugins: [fileSystemPlugin],
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
