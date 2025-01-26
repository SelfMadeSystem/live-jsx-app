import { TailwindHandler } from '../tailwind/TailwindHandler';

export type CssCompilerResult = {
  css: string;
  tailwindClasses: {
    className: string;
    css: string;
  }[];
  notTailwindClasses: string[];
  errors?: string[];
  warnings?: string[];
};

export type CssCompilerOptions = {
  tailwindHandler: TailwindHandler;
  signal?: AbortSignal;
};

export async function compileCss(
  css: string,
  classes: string[],
  { tailwindHandler, signal }: CssCompilerOptions,
): Promise<CssCompilerResult> {
  if (!css.includes('@import')) {
    // If not importing tailwind, add it to the top of the css
    css = '@import "tailwindcss";' + css;
  }
  return tailwindHandler.buildCss(css, classes, signal);
}
