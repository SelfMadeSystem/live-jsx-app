import { MonacoContext } from './monaco/MonacoContext';
import { ShadowDomCreator } from './shadowDom/ShadowDomCreator';
import AnsiToHtml from 'ansi-to-html';
import { Console, Hook, Unhook } from 'console-feed';
import type { Message } from 'console-feed/lib/definitions/Component';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import { useContext, useEffect, useState } from 'react';

const ansiToHtml = new AnsiToHtml();

const tabs = ['result', 'console', 'code'] as const;

type Tab = (typeof tabs)[number];

export function Result({
  logs,
  setLogs,
}: {
  logs: Message[];
  setLogs: React.Dispatch<React.SetStateAction<Message[]>>;
}) {
  const { compilerResult } = useContext(MonacoContext);
  const { builtJs, builtCss, errors, warnings, transformedCss, transformedJs } =
    compilerResult;
  const [tab, setTab] = useState<Tab>(tabs[0]);
  const ansiErrors = errors.map(e => ansiToHtml.toHtml(e));
  const ansiWarnings = warnings.map(w => ansiToHtml.toHtml(w));
  const highlightJs = hljs.highlight(builtJs, {
    language: 'javascript',
  }).value;
  const highlightedCss = hljs.highlight(builtCss, {
    language: 'css',
  }).value;

  useEffect(() => {
    const hookedConsole = Hook(
      window.console,
      // @ts-expect-error console-feed types are inconsistent
      log => setLogs(currLogs => [...currLogs, log]),
      false,
    );
    return () => {
      Unhook(hookedConsole);
    };
  }, [setLogs]);

  const codeTab = (
    <CodeTab
      js={highlightJs}
      css={highlightedCss}
      warnings={ansiWarnings}
      errors={ansiErrors}
    />
  );

  const consoleTab = (
    <div className="bg-gray-900 text-white">
      {logs.length === 0 ? (
        <div className="p-2">No logs</div>
      ) : (
        <Console logs={logs} variant="dark" />
      )}
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`${
              t === tab ? 'bg-gray-200' : 'bg-gray-100'
            } flex-1 cursor-pointer p-2 text-center`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'code' && codeTab}
      {tab === 'console' && consoleTab}
      <div className={`h-full ${tab === 'result' ? '' : 'hidden'}`}>
        <ResultTab js={transformedJs} css={transformedCss} />
      </div>
    </div>
  );
}

function CodeTab({
  js,
  css,
  warnings,
  errors,
}: {
  js: string;
  css: string;
  warnings: string[];
  errors: string[];
}) {
  const [tab, setTab] = useState<'js' | 'css' | 'logs'>('js');

  return (
    <div className="flex h-full w-full">
      <div className="flex h-full w-full flex-col">
        <div className="flex">
          {['js', 'css', 'logs'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t as 'js' | 'css' | 'logs')}
              className={`${
                t === tab ? 'bg-gray-200' : 'bg-gray-100'
              } flex-1 cursor-pointer p-2 text-center`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className={`h-full ${tab === 'js' ? '' : 'hidden'}`}>
          <pre
            className="h-full overflow-auto p-2"
            dangerouslySetInnerHTML={{ __html: js }}
          />
        </div>
        <div className={`h-full ${tab === 'css' ? '' : 'hidden'}`}>
          <pre
            className="h-full overflow-auto p-2"
            dangerouslySetInnerHTML={{ __html: css }}
          />
        </div>
        <div className={`h-full ${tab === 'logs' ? '' : 'hidden'}`}>
          <div className="bg-gray-900 text-white">
            {errors.length === 0 ? (
              <div className="p-2">No errors</div>
            ) : (
              <div className="p-2">
                <h3>Errors</h3>
                {errors.map((e, i) => (
                  <div key={i} dangerouslySetInnerHTML={{ __html: e }} />
                ))}
              </div>
            )}
            {warnings.length === 0 ? (
              <div className="p-2">No warnings</div>
            ) : (
              <div className="p-2">
                <h3>Warnings</h3>
                {warnings.map((w, i) => (
                  <div key={i} dangerouslySetInnerHTML={{ __html: w }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultTab({ js, css }: { js: string; css: string }) {
  return (
    <div className="flex h-full flex-col bg-gray-100 p-2">
      <ShadowDomCreator js={js} css={css} />
    </div>
  );
}
