import { Icons } from './constants';
import { MonacoContext } from './monaco/MonacoContext';
import { ShadowDomCreator } from './shadowDom/ShadowDomCreator';
import AnsiToHtml from 'ansi-to-html';
import { Console, Hook, Unhook } from 'console-feed';
import type { Message } from 'console-feed/lib/definitions/Component';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.min.css';
import { useContext, useEffect, useState } from 'react';

const TabButton = ({
  isActive,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  isActive: boolean;
  onClick: () => void;
  icon: () => JSX.Element;
  label: string;
  count: number;
}) => (
  <button
    onClick={onClick}
    className={`group relative flex flex-1 items-center justify-center gap-2.5 p-3 transition-all duration-200 ease-in-out hover:bg-zinc-800/80 ${
      isActive
        ? 'bg-zinc-800 text-white after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:rounded-full after:bg-white'
        : 'bg-black text-zinc-400 hover:text-white'
    } `}
  >
    <span
      className={`transition-transform duration-200 ease-in-out ${isActive ? 'scale-105' : 'group-hover:scale-105'} `}
    >
      <Icon />
    </span>
    <span className="font-medium tracking-wide">{label}</span>
    {count > 0 && (
      <span
        className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-200 ${isActive ? 'bg-white/20 text-white' : 'bg-zinc-700 text-zinc-300'} `}
      >
        {count}
      </span>
    )}
  </button>
);

const SubTabButton = ({
  isActive,
  onClick,
  icon: Icon,
  label,
}: {
  isActive: boolean;
  onClick: () => void;
  icon: () => JSX.Element;
  label: string;
}) => (
  <button
    onClick={onClick}
    className={`group relative flex items-center justify-center gap-2 rounded-lg px-4 py-2 transition-all duration-200 ease-in-out hover:bg-zinc-700/50 ${
      isActive ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
    } `}
  >
    <span
      className={`transition-transform duration-200 ease-in-out ${isActive ? 'scale-105' : 'group-hover:scale-105'} `}
    >
      <Icon />
    </span>
    <span className="text-sm font-medium tracking-wide">{label}</span>
  </button>
);

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
    <div className="flex h-full flex-col bg-zinc-900">
      <div className="flex bg-black/40">
        <TabButton
          isActive={tab === 'result'}
          onClick={() => setTab('result')}
          icon={Icons.Web}
          label="Result"
          count={0}
        />
        <TabButton
          isActive={tab === 'console'}
          onClick={() => setTab('console')}
          icon={Icons.Console}
          label="Console"
          count={logs.length}
        />
        <TabButton
          isActive={tab === 'code'}
          onClick={() => setTab('code')}
          icon={Icons.Code}
          label="Code"
          count={errors.length}
        />
      </div>

      <div className="flex-1 overflow-hidden bg-zinc-800/50 text-white">
        {tab === 'code' && codeTab}
        {tab === 'console' && consoleTab}
        <div className={`h-full ${tab === 'result' ? '' : 'hidden'}`}>
          <ResultTab js={transformedJs} css={transformedCss} />
        </div>
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
  const [tab, setTab] = useState<'js' | 'css' | 'logs'>(
    errors.length + warnings.length > 0 ? 'logs' : 'js',
  );

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex gap-2 border-b border-zinc-800 p-2">
        <SubTabButton
          isActive={tab === 'js'}
          onClick={() => setTab('js')}
          icon={Icons.JavaScript}
          label="JavaScript"
        />
        <SubTabButton
          isActive={tab === 'css'}
          onClick={() => setTab('css')}
          icon={Icons.CSS}
          label="CSS"
        />
        <SubTabButton
          isActive={tab === 'logs'}
          onClick={() => setTab('logs')}
          icon={Icons.Logs}
          label="Logs"
        />
      </div>

      <div className="flex-1 overflow-auto">
        <div className={`h-full ${tab === 'js' ? '' : 'hidden'}`}>
          <pre
            className="p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: js }}
          />
        </div>
        <div className={`h-full ${tab === 'css' ? '' : 'hidden'}`}>
          <pre
            className="p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: css }}
          />
        </div>
        <div className={`h-full ${tab === 'logs' ? '' : 'hidden'}`}>
          <div className="p-4 text-white">
            {errors.length === 0 ? (
              <div className="text-zinc-400">No errors</div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-medium text-red-400">Errors</h3>
                {errors.map((e, i) => (
                  <pre
                    key={i}
                    className="text-sm"
                    dangerouslySetInnerHTML={{ __html: e }}
                  />
                ))}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="font-medium text-yellow-400">Warnings</h3>
                {warnings.map((w, i) => (
                  <pre
                    key={i}
                    className="text-sm"
                    dangerouslySetInnerHTML={{ __html: w }}
                  />
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
    <div className="flex h-full flex-col bg-[#212121] p-2">
      <ShadowDomCreator js={js} css={css} />
    </div>
  );
}
