import { TailwindHandler } from '../tailwind/TailwindHandler';
import { compileCss } from './parseCss';
import { compileTsx } from './parseTsx';
import {
  TransformCssPropertiesOptions,
  transformCssProperties,
} from './propertyTransform';

export type TransformedProperty = PropertyDefinition & { original: string };

export type CompilerResult = {
  /** The original TypeScript code. */
  tsx: string;
  /** Whether the TypeScript code was successfully compiled. */
  tsxSuccess: boolean;
  /** The original CSS code. */
  css: string;
  /** Whether the CSS code was successfully compiled. */
  cssSuccess: boolean;
  /** The non-tailwind CSS classes found in the TypeScript code. */
  classes: string[];
  /** The tailwind CSS classes found in the TypeScript code including their corresponding CSS. */
  twClasses: { name: string; css: string; color?: string }[];
  /** The built JavaScript code. */
  builtJs: string;
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
  tsx: '',
  tsxSuccess: false,
  css: '',
  cssSuccess: false,
  classes: [],
  twClasses: [],
  builtJs: '',
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
};

export async function compile(
  tsx: string,
  css: string,
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
  const compiledTsx = await compileTsx(tsx);
  if ('error' in compiledTsx && compiledTsx.error) {
    result.errors.push(compiledTsx.error);
  }
  if ('warning' in compiledTsx && compiledTsx.warning) {
    result.warnings.push(compiledTsx.warning);
  }
  if ('code' in compiledTsx && compiledTsx.code) {
    result.builtJs = compiledTsx.code;
    result.tsxSuccess = true;
    result.tsx = tsx;
  }
  let classes: string[] = [];
  if ('classList' in compiledTsx && compiledTsx.classList) {
    classes = Array.from(compiledTsx.classList);
  } else {
    classes = [...result.classes, ...result.twClasses.map(tw => tw.name)];
  }

  if (tailwindHandler) {
    const compiledCss = await compileCss(css, classes, tailwindHandler);
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
  } else {
    // No tailwind handler, so it doesn't matter.
    result.builtCss = css;
    result.cssSuccess = true;
    result.css = css;
  }

  if (result.builtJs && result.builtCss) {
    const transformed = transformCssProperties(
      result.builtCss,
      result.builtJs,
      transform,
    );
    result.properties = transformed.properties;
    result.transformedJs = transformed.js;
    result.transformedCss = transformed.css;
  }

  return result;
}
