import type * as m from 'monaco-editor';
import propTypesTypings from '../../node_modules/@types/prop-types/index.d.ts?raw';
import reactGlobalTypings from '../../node_modules/@types/react/global.d.ts?raw';
import reactIndexTypings from '../../node_modules/@types/react/index.d.ts?raw';
import csstypeTypings from '../../node_modules/csstype/index.d.ts?raw';
import { MonacoContext } from './MonacoContext';
import { rules, tokenProvider } from './token-provider';
import loader from '@monaco-editor/loader';
import { emmetCSS, emmetHTML, registerCustomSnippets } from 'emmet-monaco-es';
import type { MonacoTailwindcss } from 'monaco-tailwindcss';
import { useEffect, useRef, useState } from 'react';

export function MonacoProvider({ children }: { children: React.ReactNode }) {
  const [monaco, setMonaco] = useState<typeof m | null>(null);
  const [tailwindcss, setTailwindcss] = useState<MonacoTailwindcss | null>(
    null,
  );
  const [tailwindEnabled, _setTailwindEnabled] = useState(true);
  const classListRef = useRef<string[]>([]);
  const [classList, _setClassList] = useState<string[]>([]);

  function setClassList(classList: string[]) {
    classListRef.current = classList;
    _setClassList(classList);
  }

  async function setTailwindEnabled(enabled: boolean) {
    _setTailwindEnabled(enabled);
    if (!monaco) return;
    if (enabled) {
      if (tailwindcss) return;
      const { configureMonacoTailwindcss } = await import('monaco-tailwindcss');

      // It appears that `tailwindcssData` is automatically loaded.

      const mtw = configureMonacoTailwindcss(monaco);
      setTailwindcss(mtw);
    } else {
      if (!tailwindcss) return;
      setTailwindcss(null);
      monaco.languages.css.cssDefaults.setOptions({});
      if (tailwindcss) tailwindcss?.dispose();
    }
  }

  const initted = useRef(false);

  useEffect(() => {
    if (initted.current) return;
    initted.current = true;
    function NewWorker(url: string) {
      const worker = new Worker(new URL(url, window.location.origin).href, {
        type: 'module',
      });

      return worker;
    }

    window.MonacoEnvironment = {
      getWorker(_workerId, label) {
        switch (label) {
          case 'editorWorkerService':
            return NewWorker('/esm/vs/editor/editor.worker.js');
          case 'css':
            return NewWorker('/esm/vs/language/css/css.worker.js');
          case 'html':
            return NewWorker('/esm/vs/language/html/html.worker.js');
          case 'typescript':
          case 'javascript':
            return NewWorker('/esm/vs/language/typescript/ts.worker.js');
          case 'tailwindcss':
            return NewWorker('/tailwindcss.worker.js');
          default:
            throw new Error(`Unknown worker label: ${label}`);
        }
      },
    };

    loader.config({
      paths: {
        vs: new URL('/min/vs', window.location.origin).href,
      },
    });

    loader.init().then(async monaco => {
      setMonaco(monaco);
      emmetCSS(monaco);
      emmetHTML(monaco);

      registerCustomSnippets('css', {
        '@property': `\
@property --\${1:property} {
  syntax: '\${2:value}';
  inherits: \${3:initial};
  initial-value: \${4:initial};
}`,
      });

      monaco.editor.defineTheme('vsc2', {
        base: 'vs-dark',
        inherit: true,
        rules,
        colors: {
          'editor.background': '#1e1e1e',
        },
      });

      monaco.languages.setMonarchTokensProvider(
        'typescript',
        tokenProvider as m.languages.IMonarchLanguage,
      );

      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        jsx: monaco.languages.typescript.JsxEmit.React,
        allowNonTsExtensions: true,
        moduleResolution:
          monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        typeRoots: ['node_modules/@types'],
      });
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        reactIndexTypings,
        'node_modules/@types/react/index.d.ts',
      );
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        reactGlobalTypings,
        'node_modules/@types/react/global.d.ts',
      );
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        csstypeTypings,
        'node_modules/@types/csstype/index.d.ts',
      );
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        propTypesTypings,
        'node_modules/@types/prop-types/index.d.ts',
      );
      monaco.languages.registerCompletionItemProvider('css', {
        provideCompletionItems(model, position) {
          function getImmediateRulesetSelector() {
            const text = model.getValueInRange({
              startLineNumber: 0,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            });

            let paren = 0;
            let firstParenIndex = -1;
            let lastParenIndex = -1;

            for (let i = text.length - 1; i >= 0; i--) {
              if (text[i] === '}') {
                paren--;
              } else if (text[i] === '{') {
                paren++;

                if (paren === 1) {
                  lastParenIndex = i;
                  continue;
                }
              }

              if (lastParenIndex !== -1 && paren !== 1) {
                firstParenIndex = i;
                break;
              }
            }

            if (firstParenIndex === -1 && lastParenIndex === -1) {
              return '';
            }

            return text.slice(firstParenIndex + 1, lastParenIndex).trim();
          }

          function isWithinRulesetDefinition() {
            const selector = getImmediateRulesetSelector();

            const exceptAtRules = [
              '@container',
              '@layer',
              '@media',
              '@scope',
              '@supports',
            ];

            return (
              selector.length > 0 &&
              !exceptAtRules.some(rule => selector.startsWith(rule))
            );
          }

          if (isWithinRulesetDefinition()) return;

          const suggestions =
            classListRef.current.map<m.languages.CompletionItem>(className => ({
              label: `.${className}`,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: `.${className}`,
              range: new monaco.Range(
                position.lineNumber,
                position.column - 1,
                position.lineNumber,
                position.column,
              ),
            }));

          return { suggestions };
        },
      });

      const { configureMonacoTailwindcss } = await import('monaco-tailwindcss');

      // It appears that `tailwindcssData` is automatically loaded.

      const mtw = configureMonacoTailwindcss(monaco);
      setTailwindcss(mtw);
    });
  }, []);

  return (
    <MonacoContext.Provider
      value={{
        monaco,
        tailwindcss,
        tailwindEnabled,
        setTailwindEnabled,
        classList,
        setClassList,
      }}
    >
      {children}
    </MonacoContext.Provider>
  );
}
