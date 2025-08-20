import type * as m from 'monaco-editor';
import propTypesTypings from '../../node_modules/@types/prop-types/index.d.ts?raw';
import reactDomClientTypings from '../../node_modules/@types/react-dom/client.d.ts?raw';
import reactDomIndexTypings from '../../node_modules/@types/react-dom/index.d.ts?raw';
import reactGlobalTypings from '../../node_modules/@types/react/global.d.ts?raw';
import reactIndexTypings from '../../node_modules/@types/react/index.d.ts?raw';
import csstypeTypings from '../../node_modules/csstype/index.d.ts?raw';
import TailwindWorker from '../tailwind/tailwind.worker?worker';
import {
  CompilerResult,
  defaultCompilerResult,
} from '../compiler/compilerResult';
import {
  TailwindHandler,
} from '../tailwind/TailwindHandler';
import { MonacoContext } from './MonacoContext';
import { tokenProvider } from './token-provider';
import loader from '@monaco-editor/loader';
import { Message } from 'console-feed/lib/definitions/Component';
import { emmetCSS, emmetHTML, registerCustomSnippets } from 'emmet-monaco-es';
import { useEffect, useRef, useState } from 'react';
import { createLogger } from '../logger';

const logger = createLogger('MonacoProvider');

export function MonacoProvider({ children }: { children: React.ReactNode }) {
  const [monaco, setMonaco] = useState<typeof m | null>(null);
  const [tailwindcss, setTailwindcss] = useState<TailwindHandler | null>(null);
  const [importMap, setImportMap] = useState<Record<string, string>>({});
  const compilerResultRef = useRef<CompilerResult>(defaultCompilerResult);
  const [compilerResult, _setCompilerResult] = useState(defaultCompilerResult);
  const [logs, setLogs] = useState<Message[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  function setCompilerResult(result: CompilerResult) {
    _setCompilerResult(result);
    compilerResultRef.current = result;
  }

  function clearLogs() {
    setLogs([]);
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
        logger.debug('getWorker', _workerId, label);
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
            return new TailwindWorker();
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
  inherits: \${3:inherits};
  initial-value: \${4:initial};
}`,
      });

      monaco.languages.setMonarchTokensProvider(
        'typescript',
        tokenProvider as m.languages.IMonarchLanguage,
      );

      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        jsx: monaco.languages.typescript.JsxEmit.Preserve,
        allowNonTsExtensions: true,
        moduleResolution:
          monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        esModuleInterop: true,
        allowUmdGlobalAccess: true,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        typeRoots: ['types'],
      });
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        reactIndexTypings,
        'types/react/index.d.ts',
      );
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        reactGlobalTypings,
        'file:///types/react/global.d.ts',
      );
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        csstypeTypings,
        'types/csstype/index.d.ts',
      );
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        propTypesTypings,
        'types/prop-types/index.d.ts',
      );
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        reactDomIndexTypings,
        'types/react-dom/index.d.ts',
      );
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        reactDomClientTypings,
        'types/react-dom/client.d.ts',
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
            compilerResultRef.current.classes.map<m.languages.CompletionItem>(
              className => ({
                label: `.${className}`,
                kind: monaco.languages.CompletionItemKind.Class,
                insertText: `.${className}`,
                range: new monaco.Range(
                  position.lineNumber,
                  position.column - 1,
                  position.lineNumber,
                  position.column,
                ),
              }),
            );

          return { suggestions };
        },
      });

      const tailwind = new TailwindHandler();
      setTailwindcss(tailwind);
      tailwind.configureMonaco(monaco);

      logger.debug('Monaco initialized');
    });
  }, []);

  return (
    <MonacoContext.Provider
      value={{
        monaco,
        tailwindcss,
        importMap,
        setImportMap,
        compilerResultRef,
        compilerResult,
        setCompilerResult,
        logs,
        setLogs,
        clearLogs,
        showErrors,
        setShowErrors,
      }}
    >
      {children}
    </MonacoContext.Provider>
  );
}
