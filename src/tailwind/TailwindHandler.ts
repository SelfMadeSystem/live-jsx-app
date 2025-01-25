import type * as m from 'monaco-editor';
import { tailwindcssData } from './cssData';
import TailwindWorker from './tailwind.worker?worker';

let worker: Worker | null = null;

function getWorker() {
  if (!worker) {
    worker = new TailwindWorker();
  }
  return worker;
}

export class TailwindHandler {
  private previousCss = '';

  constructor() {
    getWorker();
  }

  public configureMonaco(monaco: typeof m) {
    const options = monaco.languages.css.cssDefaults.options;
    monaco.languages.css.cssDefaults.setOptions({
      ...options,
      data: {
        ...options.data,
        dataProviders: {
          ...options.data?.dataProviders,
          tailwindcss: tailwindcssData,
        },
      },
    });
  }

  public async buildCss(css: string, classes: string[]): Promise<string> {
    if (this.previousCss === css) {
      return this.previousCss;
    }
    return new Promise(resolve => {
      getWorker().addEventListener('message', event => {
        if (event.data.type === 'buildCssResult') {
          this.previousCss = event.data.result;
          resolve(event.data.result);
        }
      });
      getWorker().postMessage({
        type: 'buildCss',
        css,
        classes,
      });
    });
  }

  public async buildClasses(classes: string[]): Promise<string> {
    return new Promise(resolve => {
      getWorker().addEventListener('message', event => {
        if (event.data.type === 'buildClassesResult') {
          resolve(event.data.result);
        }
      });
      getWorker().postMessage({
        type: 'buildClasses',
        classes,
      });
    });
  }
}
