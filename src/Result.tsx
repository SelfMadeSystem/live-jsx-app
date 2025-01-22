import { MonacoContext } from './monaco/MonacoContext';
import AnsiToHtml from 'ansi-to-html';
import { Console, Hook, Unhook } from 'console-feed';
import type { Message } from 'console-feed/lib/definitions/Component';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import { useContext, useEffect, useId, useRef, useState } from 'react';

const ansiToHtml = new AnsiToHtml();

const tabs = ['result', 'console', 'code'] as const;

type Tab = (typeof tabs)[number];

export type CompilerResult = {
  code?: string;
  error?: string;
  warning?: string;
} & (
  | {
      code: string;
    }
  | {
      error: string;
    }
  | {
      warning: string;
    }
);

export function Result({
  result: { code, error, warning },
  logs,
  setLogs,
}: {
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
    <div>
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
      {code ? (
        <div className={tab === 'result' ? '' : 'hidden'}>
          <ResultTab code={code} />
        </div>
      ) : (
        tab === 'result' && codeTab
      )}
    </div>
  );
}

function ResultTab({ code }: { code: string }) {
  const { tailwindcss } = useContext(MonacoContext);
  const scriptParentRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLStyleElement>(null);
  const rootId = useId();
  const prevObjUrl = useRef<string | null>(null);

  useEffect(() => {
    const scriptParent = scriptParentRef.current;
    const style = styleRef.current;
    if (!scriptParent || !style) return;

    if (tailwindcss) {
      tailwindcss
        ?.generateStylesFromContent(
          `\
@tailwind base;
@tailwind components;
@tailwind utilities;`,
          [code],
        )
        .then(css => {
          style.textContent = css;
        });
    }

    const data = new TextEncoder().encode(code);
    const blob = new Blob([data], { type: 'application/javascript' });

    if (prevObjUrl.current) {
      URL.revokeObjectURL(prevObjUrl.current);
    }
    const url = URL.createObjectURL(blob);
    prevObjUrl.current = url;

    console.log(url);

    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `\
import React from "react";
import ReactDOM from "react-dom";
import App from "${url}";

console.log(App);

ReactDOM.render(
  React.createElement(App),
  document.getElementById("${rootId}")
);`;
    scriptParent.innerHTML = '';
    scriptParent.appendChild(script);
  }, [code, rootId, tailwindcss]);

  return (
    <div className="bg-gray-100 p-2">
      <div ref={scriptParentRef} />
      <style ref={styleRef} />
      <div id={rootId} />
    </div>
  );
}
