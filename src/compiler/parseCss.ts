import { TailwindHandler } from '../tailwind/TailwindHandler';
import { LiveFile } from './compilerResult';

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
  files: Record<string, LiveFile>,
  { tailwindHandler, signal }: CssCompilerOptions,
): Promise<CssCompilerResult> {
  if (!css.includes('@import')) {
    // If not importing tailwind, add it to the top of the css
    css = '@import "tailwindcss";' + css;
  }
  const record: Record<string, string> = {};

  for (const file of Object.values(files)) {
    if (
      file.filename.endsWith('.css') &&
      typeof file.newContents === 'string'
    ) {
      record[file.filename] = file.newContents;
    }
  }

  return tailwindHandler.buildCss(css, classes, record, signal);
}
