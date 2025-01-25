/// <reference types="vite/client" />
import * as tailwindcss from 'tailwindcss';
import index from 'tailwindcss/index.css?raw';
import preflight from 'tailwindcss/preflight.css?raw';
import theme from 'tailwindcss/theme.css?raw';
import utilities from 'tailwindcss/utilities.css?raw';

let compiler: Awaited<ReturnType<typeof tailwindcss.compile>> | null = null;

async function init() {
  compiler = await tailwindcss.compile(`@import 'tailwindcss';`, compileOptions);
}

type CompileOptions = NonNullable<Parameters<typeof tailwindcss.compile>[1]>;

const loadStylesheet: CompileOptions['loadStylesheet'] = async (id, base) => {
  switch (id) {
    case 'tailwindcss':
      return {
        base,
        content: index,
      };
    case 'tailwindcss/preflight':
    case 'tailwindcss/preflight.css':
    case './preflight.css':
      return {
        base,
        content: preflight,
      };
    case 'tailwindcss/theme':
    case 'tailwindcss/theme.css':
    case './theme.css':
      return {
        base,
        content: theme,
      };
    case 'tailwindcss/utilities':
    case 'tailwindcss/utilities.css':
    case './utilities.css':
      return {
        base,
        content: utilities,
      };
    default:
      throw new Error(`Unexpected stylesheet request: ${id}`);
  }
};

const loadModule: CompileOptions['loadModule'] = async () => {
  throw new Error('loadModule is not supported in the worker');
};

const compileOptions: CompileOptions = {
  base: '/',
  loadStylesheet,
  loadModule,
};

init();

function buildClasses(classes: string[]): string {
  if (!compiler) {
    throw new Error('Tailwind CSS compiler is not initialized');
  }
  return compiler.build(classes);
}

async function buildCss(css: string, classes: string[]): Promise<string> {
  if (!compiler) {
    throw new Error('Tailwind CSS compiler is not initialized');
  }
  compiler = await tailwindcss.compile(css, compileOptions);
  return buildClasses(classes);
}

self.addEventListener<'message'>('message', async event => {
  switch (event.data.type) {
    case 'buildClasses': {
      const result = buildClasses(event.data.classes);
      self.postMessage({
        type: 'buildClassesResult',
        result,
      });
      return;
    }
    case 'buildCss': {
      const result = await buildCss(event.data.css, event.data.classes);
      self.postMessage({
        type: 'buildCssResult',
        result,
      });
      return;
    }
  }
});
