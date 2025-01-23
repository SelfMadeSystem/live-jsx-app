import { ShadowDomCreator } from './shadowDom/ShadowDomCreator';
import AnsiToHtml from 'ansi-to-html';
import { Console, Hook, Unhook } from 'console-feed';
import type { Message } from 'console-feed/lib/definitions/Component';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import { useEffect, useState } from 'react';

const ansiToHtml = new AnsiToHtml();

const tabs = ['result', 'console', 'code'] as const;

type Tab = (typeof tabs)[number];

export type CompilerResult = {
  code?: string;
  classList?: Set<string>;
  error?: string;
  warning?: string;
} & (
  | {
      code: string;
      classList: Set<string>;
    }
  | {
      error: string;
    }
  | {
      warning: string;
    }
);

export function Result({
  css,
  result: { code, error, warning },
  logs,
  setLogs,
}: {
  css: string;
  result: CompilerResult;
  logs: Message[];
  setLogs: React.Dispatch<React.SetStateAction<Message[]>>;
}) {
  const [tab, setTab] = useState<Tab>(tabs[0]);
  const ansiError = error ? ansiToHtml.toHtml(error) : '';
  const ansiWarning = warning ? ansiToHtml.toHtml(warning) : '';
  const highlightCode = code
    ? hljs.highlight(code, {
        language: 'javascript',
      }).value
    : '';

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
    <pre className="whitespace-pre-wrap bg-gray-100 p-2">
      {error ? (
        <div dangerouslySetInnerHTML={{ __html: ansiError }} />
      ) : warning ? (
        <div dangerouslySetInnerHTML={{ __html: ansiWarning }} />
      ) : (
        <div
          dangerouslySetInnerHTML={{
            __html: highlightCode,
          }}
        />
      )}
    </pre>
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
            } flex-1 p-2 text-center`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'code' && codeTab}
      {tab === 'console' && consoleTab}
      <div className={`h-full ${(!code || tab) === 'result' ? '' : 'hidden'}`}>
        <ResultTab js={code ?? ''} css={css} />
      </div>
      {!code && tab === 'result' && codeTab}
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
