import type * as m from 'monaco-editor';
import { CssCompilerResult } from '../compiler/parseCss';
import { tailwindcssData } from './cssData';
import type {
  RealTailwindcssWorker,
  TailwindcssWorker,
  TailwindcssWorkerWithMirrorModel,
} from './tailwind.worker';
import TailwindWorker from './tailwind.worker?worker';
import { fromRatio, names as namedColors } from '@ctrl/tinycolor';
import {
  fromCompletionContext,
  fromPosition,
  toCodeAction,
  toColorInformation,
  toCompletionList,
  toHover,
  toMarkerData,
} from 'monaco-languageserver-types';
import {
  MarkerDataProvider,
  registerMarkerDataProvider,
} from 'monaco-marker-data-provider';

const colorNames = Object.values(namedColors);
let worker: Worker | null = null;

const defaultLanguageSelector = [
  'css',
  'javascript',
  'html',
  'mdx',
  'typescript',
] as const;

function getWorker() {
  if (!worker) {
    worker = new TailwindWorker();
    // @ts-expect-error 'name' is a custom property just so I know what worker is running
    worker.name = 'tailwindcss';
  }
  return worker;
}

// FIXME: Figure out why getMonacoWorker is not working
// function getMonacoWorker(...resources: m.Uri[]) {
//   if (!monacoWorker) {
//     throw new Error('Monaco worker not initialized');
//   }

//   if (resources.length === 0) {
//     return monacoWorker.getProxy();
//   }

//   return monacoWorker.withSyncedResources(resources);
// }

export { getWorker as getTailwindWorker };

async function callWorker<T extends keyof TailwindcssWorkerWithMirrorModel>(
  type: T,
  {
    signal,
    ...payload
  }: Parameters<TailwindcssWorkerWithMirrorModel[T]>[0] & {
    signal?: AbortSignal;
  },
): Promise<ReturnType<TailwindcssWorkerWithMirrorModel[T]>> {
  return new Promise<ReturnType<TailwindcssWorkerWithMirrorModel[T]>>(
    resolve => {
      const worker = getWorker();
      worker.addEventListener(
        'message',
        function doStuff(event) {
          if (event.data.type === type) {
            resolve(event.data.result);
            worker.removeEventListener('message', doStuff);
          }
        },
        {
          signal,
        },
      );
      worker.postMessage({
        type,
        ...payload,
      });
    },
  );
}

export class TailwindHandler {
  private previousCss = '';
  private previousClasses: string[] = [];
  private previousBuildCss: Awaited<ReturnType<TailwindcssWorker['buildCss']>> =
    {
      css: '',
      tailwindClasses: [],
      notTailwindClasses: [],
    };

  constructor() {
    getWorker();
  }

  public configureMonaco(monaco: typeof m) {
    const languages = defaultLanguageSelector;

    monaco.editor.createWebWorker<RealTailwindcssWorker>({
      label: 'tailwindcss',
      moduleId: '/tailwindcss/tailwind.worker',
    });

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

    const disposables: m.IDisposable[] = [
      monaco.languages.registerCompletionItemProvider(
        languages,
        createCompletionItemProvider(),
      ),
      monaco.languages.registerColorProvider(
        languages,
        createColorProvider(monaco),
      ),
      monaco.languages.registerHoverProvider(languages, createHoverProvider()),
      monaco.languages.registerCodeActionProvider(
        languages,
        createCodeActionProvider(),
      ),
    ];

    for (const language of languages) {
      disposables.push(
        registerMarkerDataProvider(
          monaco,
          language,
          createMarkerDataProvider(),
        ),
      );
    }

    return {
      dispose() {
        disposables.forEach(d => d.dispose());
      },
    };
  }

  public async buildCss(
    css: string,
    classes: string[],
    signal?: AbortSignal,
  ): Promise<CssCompilerResult> {
    if (
      this.previousCss === css &&
      this.previousClasses.every(c => classes.includes(c))
    ) {
      return this.previousBuildCss;
    }
    this.previousCss = css;
    this.previousClasses = classes;
    this.previousBuildCss = await callWorker('buildCss', {
      css,
      classes,
      signal,
    });
    return this.previousBuildCss;
  }
}

function createCompletionItemProvider(): m.languages.CompletionItemProvider {
  return {
    async resolveCompletionItem(item) {
      return callWorker('resolveCompletionItem', { item });
    },

    async provideCompletionItems(model, position, context) {
      const completionList = await callWorker('doComplete', {
        uri: model.uri.toString(),
        languageId: model.getLanguageId(),
        position: fromPosition(position),
        context: fromCompletionContext(context),
        mirrorModels: [
          {
            uri: model.uri.toJSON(),
            version: model.getVersionId(),
            value: model.getValue(),
          },
        ],
      });

      if (!completionList) {
        return;
      }

      const wordInfo = model.getWordUntilPosition(position);

      return toCompletionList(completionList, {
        range: {
          startLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: wordInfo.endColumn,
        },
      });
    },
  };
}

const editableColorRegex = new RegExp(
  `-\\[(${colorNames.join('|')}|((?:#|rgba?\\(|hsla?\\())[^\\]]+)\\]$`,
);

function colorValueToHex(value: number): string {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, '0');
}

const sheet = new CSSStyleSheet();
document.adoptedStyleSheets.push(sheet);

function createColorClass(color: m.languages.IColor): string {
  const hex = `${colorValueToHex(color.red)}${colorValueToHex(color.green)}${colorValueToHex(
    color.blue,
  )}`;
  const className = `tailwindcss-color-decoration-${hex}`;
  const selector = `.${className}`;
  for (const rule of sheet.cssRules) {
    if ((rule as CSSStyleRule).selectorText === selector) {
      return className;
    }
  }
  sheet.insertRule(`${selector}{background-color:#${hex}}`);
  return className;
}

function createColorProvider(
  monaco: typeof m,
): m.languages.DocumentColorProvider {
  const modelMap = new WeakMap<m.editor.ITextModel, string[]>();

  monaco.editor.onWillDisposeModel(model => {
    modelMap.delete(model);
  });

  return {
    async provideDocumentColors(model) {
      const colors = await callWorker('getDocumentColors', {
        uri: model.uri.toString(),
        languageId: model.getLanguageId(),
        mirrorModels: [
          {
            uri: model.uri.toJSON(),
            version: model.getVersionId(),
            value: model.getValue(),
          },
        ],
      });

      const editableColors: m.languages.IColorInformation[] = [];
      const nonEditableColors: m.editor.IModelDeltaDecoration[] = [];
      if (colors) {
        for (const lsColor of colors) {
          const monacoColor = toColorInformation(lsColor);
          const text = model.getValueInRange(monacoColor.range);
          if (editableColorRegex.test(text)) {
            editableColors.push(monacoColor);
          } else {
            nonEditableColors.push({
              range: monacoColor.range,
              options: {
                before: {
                  content: '\u00A0',
                  inlineClassName: `${createColorClass(monacoColor.color)} colorpicker-color-decoration`,
                  inlineClassNameAffectsLetterSpacing: true,
                },
              },
            });
          }
        }
      }

      modelMap.set(
        model,
        model.deltaDecorations(modelMap.get(model) ?? [], nonEditableColors),
      );

      return editableColors;
    },

    provideColorPresentations(model, colorInformation) {
      const className = model.getValueInRange(colorInformation.range);
      const match = new RegExp(
        `-\\[(${colorNames.join('|')}|(?:(?:#|rgba?\\(|hsla?\\())[^\\]]+)\\]$`,
        'i',
      ).exec(className);

      if (!match) {
        return [];
      }

      const [currentColor] = match;

      const isNamedColor = colorNames.includes(currentColor);
      const color = fromRatio({
        r: colorInformation.color.red,
        g: colorInformation.color.green,
        b: colorInformation.color.blue,
        a: colorInformation.color.alpha,
      });

      let hexValue = color.toHex8String(
        !isNamedColor &&
          (currentColor.length === 4 || currentColor.length === 5),
      );
      if (hexValue.length === 5) {
        hexValue = hexValue.replace(/f$/, '');
      } else if (hexValue.length === 9) {
        hexValue = hexValue.replace(/ff$/, '');
      }

      const rgbValue = color.toRgbString().replaceAll(' ', '');
      const hslValue = color.toHslString().replaceAll(' ', '');
      const prefix = className.slice(0, Math.max(0, match.index));

      return [
        { label: `${prefix}-[${hexValue}]` },
        { label: `${prefix}-[${rgbValue}]` },
        { label: `${prefix}-[${hslValue}]` },
      ];
    },
  };
}

function createHoverProvider(): m.languages.HoverProvider {
  return {
    async provideHover(model, position) {
      const hover = await callWorker('doHover', {
        uri: model.uri.toString(),
        languageId: model.getLanguageId(),
        position: fromPosition(position),
        mirrorModels: [
          {
            uri: model.uri.toJSON(),
            version: model.getVersionId(),
            value: model.getValue(),
          },
        ],
      });

      return hover && toHover(hover);
    },
  };
}

function createCodeActionProvider(): m.languages.CodeActionProvider {
  return {
    async provideCodeActions(model, range, context) {
      const codeActions = await callWorker('doCodeActions', {
        uri: model.uri.toString(),
        range: {
          start: fromPosition(range.getStartPosition()),
          end: fromPosition(range.getEndPosition()),
        },
        context,
        languageId: model.getLanguageId(),
        mirrorModels: [
          {
            uri: model.uri.toJSON(),
            version: model.getVersionId(),
            value: model.getValue(),
          },
        ],
      });

      if (codeActions) {
        return {
          actions: codeActions.map(toCodeAction),
          dispose() {
            // Do nothing
          },
        };
      }
    },
  };
}

function createMarkerDataProvider(): MarkerDataProvider {
  return {
    owner: 'tailwindcss',
    async provideMarkerData(model) {
      const diagnostics = await callWorker('doValidate', {
        uri: model.uri.toString(),
        languageId: model.getLanguageId(),
        mirrorModels: [
          {
            uri: model.uri.toJSON(),
            version: model.getVersionId(),
            value: model.getValue(),
          },
        ],
      });

      return diagnostics?.map(toMarkerData);
    },
  };
}
