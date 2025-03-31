import type * as m from 'monaco-editor';
import { TailwindHandler } from '../tailwind/TailwindHandler';
import { compileCss } from './parseCss';
import { type TypeScriptFile, compileTsx, transformJs } from './parseTsx';
import {
  TransformCssPropertiesOptions,
  transformCssProperties,
} from './propertyTransform';
import { Module } from '@swc/wasm-web';

export type TransformedProperty = PropertyDefinition & { original: string };

export type CompilerResult = {
  /** The TypeScript files excluding the main file. */
  tsFiles: Record<string, TypeScriptFile>;
  /** The new TypeScript code. */
  newTsx: string;
  /** The original TypeScript code. */
  tsx: string;
  /** Whether the TypeScript code was successfully compiled. */
  tsxSuccess: boolean;
  /** The new CSS code. */
  newCss: string;
  /** The original CSS code. */
  css: string;
  /** Whether the CSS code was successfully compiled. */
  cssSuccess: boolean;
  /** All the CSS classes found in the TypeScript code. */
  allClasses: string[];
  /** The non-tailwind CSS classes found in the TypeScript code. */
  classes: string[];
  /** The tailwind CSS classes found in the TypeScript code including their corresponding CSS. */
  twClasses: { name: string; css: string; color?: string }[];
  /** The built JavaScript code. */
  builtJs: string;
  /** The parsed module */
  module: Module | null;
  /** The built CSS code. */
  builtCss: string;
  /** The transformed JavaScript code after applying `@property` transformations. */
  transformedJs: string;
  /** The transformed CSS code after applying `@property` transformations. */
  transformedCss: string;
  /** The `@property` transformations. */
  properties: TransformedProperty[];
  /** Any errors that occurred during compilation. */
  errors: string[];
  /** Any warnings that occurred during compilation. */
  warnings: string[];
};

export const defaultCompilerResult: CompilerResult = {
  tsFiles: {},
  newTsx: '',
  tsx: '',
  tsxSuccess: false,
  newCss: '',
  css: '',
  cssSuccess: false,
  allClasses: [],
  classes: [],
  twClasses: [],
  builtJs: '',
  module: null,
  builtCss: '',
  transformedJs: '',
  transformedCss: '',
  properties: [],
  errors: [],
  warnings: [],
};

export type CompilerOptions = {
  /** The tailwind handler */
  tailwindHandler?: TailwindHandler | null;
  /** The transformer options. */
  transform?: TransformCssPropertiesOptions;
  /** The import map to use for the compilation. */
  importMap: Record<string, string>;
  /** The function to set the import map. */
  setImportMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  /** Monaco */
  monaco: typeof m;
  /** The AbortSignal to cancel the compilation. */
  signal?: AbortSignal;
};

export const abortSymbol = Symbol('abort');

export async function compile(
  previousResult: CompilerResult,
  options: CompilerOptions,
): Promise<CompilerResult> {
  const { tailwindHandler, transform } = options;
  const result: CompilerResult = {
    ...structuredClone(previousResult),
    tsxSuccess: false,
    cssSuccess: false,
    errors: [],
    warnings: [],
  };

  let isDifferent = false;

  const tsx = result.newTsx;
  const css = result.newCss;

  if (tsx !== previousResult.tsx) {
    const compiledTsx = await compileTsx(tsx, {
      signal: options.signal,
    });
    if ('errors' in compiledTsx && compiledTsx.errors) {
      result.errors.push(...compiledTsx.errors);
    }
    if ('warnings' in compiledTsx && compiledTsx.warnings) {
      result.warnings.push(...compiledTsx.warnings);
    }
    if ('code' in compiledTsx && compiledTsx.code) {
      result.builtJs = compiledTsx.code;
      result.tsxSuccess = true;
      result.tsx = tsx;
    }
    if ('parsedModule' in compiledTsx && compiledTsx.parsedModule) {
      result.module = compiledTsx.parsedModule;
    }
    if ('classList' in compiledTsx && compiledTsx.classList) {
      result.allClasses = Array.from(compiledTsx.classList);
    } else {
      result.allClasses = [
        ...result.classes,
        ...result.twClasses.map(tw => tw.name),
      ];
    }

    isDifferent = true;
  } else {
    result.tsxSuccess = previousResult.tsxSuccess;
  }

  for (const file in result.tsFiles) {
    const tsFile = result.tsFiles[file];
    if (tsFile.newContents !== tsFile.contents) {
      const compiledTsx = await compileTsx(tsFile.newContents, {
        signal: options.signal,
      });
      if ('errors' in compiledTsx && compiledTsx.errors) {
        result.errors.push(...compiledTsx.errors);
      }
      if ('warnings' in compiledTsx && compiledTsx.warnings) {
        result.warnings.push(...compiledTsx.warnings);
      }
      if ('code' in compiledTsx && compiledTsx.code) {
        tsFile.builtJs = compiledTsx.code;
        tsFile.success = true;
        tsFile.contents = tsFile.newContents;
      }
      if ('parsedModule' in compiledTsx && compiledTsx.parsedModule) {
        tsFile.module = compiledTsx.parsedModule;
      }
      if ('classList' in compiledTsx && compiledTsx.classList) {
        tsFile.classList = Array.from(compiledTsx.classList);
        result.allClasses.push(...tsFile.classList);
      } else {
        tsFile.classList = [];
      }
    }
  }

  if (tailwindHandler) {
    if (
      css !== previousResult.css ||
      previousResult.allClasses.length !== result.allClasses.length ||
      result.allClasses.some(c => !previousResult.allClasses.includes(c))
    ) {
      const compiledCss = await compileCss(css, result.allClasses, {
        tailwindHandler,
        signal: options.signal,
      });
      if (compiledCss.errors) {
        result.errors.push(...compiledCss.errors);
      }
      if (compiledCss.warnings) {
        result.warnings.push(...compiledCss.warnings);
      }
      if (compiledCss.css) {
        result.builtCss = compiledCss.css;
        result.cssSuccess = true;
        result.css = css;
      }
      result.classes = compiledCss.notTailwindClasses;
      result.twClasses = compiledCss.tailwindClasses.map(tw => ({
        name: tw.className,
        css: tw.css,
        // no color for now
      }));

      isDifferent = true;
    } else {
      result.cssSuccess = previousResult.cssSuccess;
    }
  } else {
    // No tailwind handler, so it doesn't matter.
    if (css !== previousResult.css) {
      result.builtCss = css;
      result.cssSuccess = true;
      result.css = css;
      isDifferent = true;
    } else {
      result.cssSuccess = previousResult.cssSuccess;
    }
  }

  if (result.builtJs && result.builtCss && isDifferent) {
    const transformed = transformCssProperties(
      result.builtCss,
      result.builtJs,
      result.tsFiles,
      transform,
    );
    result.properties = transformed.properties;
    result.transformedJs = transformed.js;
    result.transformedCss = transformed.css;
    for (const file in result.tsFiles) {
      result.tsFiles[file].transformedJs = transformed.jsFiles[file];
    }

    if (result.module) {
      const transformedJs = await transformJs(result.module, {
        files: Object.values(result.tsFiles),
        importMap: options.importMap,
        monaco: options.monaco,
        setImportMap: options.setImportMap,
        signal: options.signal,
      });

      if ('errors' in transformedJs && transformedJs.errors) {
        result.errors.push(...transformedJs.errors);
      }
      if ('warnings' in transformedJs && transformedJs.warnings) {
        result.warnings.push(...transformedJs.warnings);
      }
      if ('code' in transformedJs && transformedJs.code) {
        result.transformedJs = transformedJs.code;
      }
    }
  }

  return result;
}
