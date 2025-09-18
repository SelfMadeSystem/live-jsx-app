import type * as m from 'monaco-editor';
import { Result } from './Result';
import { abortSymbol, compile } from './compiler/compilerResult';
import { DEFAULT_CSS, DEFAULT_TSX } from './consts';
import { createLogger } from './logger';
import { MonacoContext } from './monaco/MonacoContext';
import { MonacoEditors } from './monaco/MonacoEditors';
import { useLocalStorage } from './utils';
import { Hook, Unhook } from 'console-feed';
import { initialize } from 'esbuild-wasm';
import esbuildUrl from 'esbuild-wasm/esbuild.wasm?url';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';

const logger = createLogger('App');

let esbuildStarted = false;
let esbuildInitialized = false;

export default function App() {
  const {
    importMap,
    setImportMap,
    monaco,
    setCompilerResult,
    compilerResultRef,
    tailwindcss,
    clearLogs,
    setLogs,
  } = useContext(MonacoContext);
  const parentRef = useRef<HTMLDivElement>(null);
  const lineWidth = 4;
  const hPercentRef = useRef(1);
  const wPercentRef = useRef(0.5);
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
  const [height, setHeight] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [authKey, setAuthKey] = useLocalStorage<string | null>(
    'live-jsx-app-auth-key',
    null,
  );
  const resizeCbRef = useRef<() => void>(() => {});

  const [initialized, setInitialized] = useState(esbuildInitialized);
  const rebuildRef = useRef<m.editor.ITextModel[]>([]);

  const saveProject = useCallback(async () => {
    if (!authKey) {
      toast.warning(
        'Without an Auth Key, projects will only be saved for up to 7 days. Ask me for one on Discord if you want longer!',
      );
    }

    const models = monaco?.editor.getModels() || [];
    const files: { filename: string; contents: string }[] = [];
    for (const model of models) {
      const path = model.uri.path.substring(1);
      // Don't save .d.ts files
      if (path.endsWith('.d.ts')) {
        continue;
      }
      files.push({ filename: path, contents: model.getValue() });
    }

    const result = await fetch('https://nan.shoghisimon.ca/', {
      method: 'POST',
      headers: authKey
        ? {
            'Content-Type': 'application/json',
            'X-Auth-Token': authKey,
          }
        : { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    });

    if (!result.ok) {
      toast.error(`Error saving project: ${result.statusText}`);
      return;
    }

    const { id } = await result.json();

    navigator.clipboard.writeText(
      `https://live-jsx-app.shoghisimon.ca/?id=${id}`,
    );
    toast.success('Project saved! URL copied to clipboard.');
    logger.info('Project saved', id);
  }, [authKey, monaco?.editor]);

  const handleChange = useCallback(
    async (model: m.editor.ITextModel) => {
      if (!initialized) {
        logger.debug('esbuild not initialized yet');
        rebuildRef.current.push(model); // rebuild when esbuild is initialized
        return;
      }
      logger.info('Model changed', model.uri.path);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const prevResult = compilerResultRef.current;

      const path = model.uri.path.substring(1);
      if (path === 'main.tsx') {
        compilerResultRef.current.newTsx = model.getValue();
      } else if (path === 'main.css') {
        compilerResultRef.current.newCss = model.getValue();
      } else {
        if (!compilerResultRef.current.files[path]) {
          compilerResultRef.current.files[path] = {
            filename: path,
            contents: '',
            newContents: model.getValue(),
          };
        } else {
          compilerResultRef.current.files[path].newContents = model.getValue();
        }
      }

      const newResult = await compile(compilerResultRef.current, {
        tailwindHandler: tailwindcss,
        importMap,
        setImportMap,
        monaco: monaco!,
        signal: abortControllerRef.current?.signal,
      }).catch(e => {
        if (e !== abortSymbol) {
          console.error(e);
        }
        return abortSymbol;
      });

      if (typeof newResult === 'symbol') {
        return;
      }

      setCompilerResult(newResult);

      if (
        prevResult.transformedJs !== newResult.transformedJs ||
        prevResult.errors.length !== newResult.errors.length ||
        prevResult.warnings.length !== newResult.warnings.length
      ) {
        clearLogs();
      }
    },
    [
      clearLogs,
      compilerResultRef,
      importMap,
      initialized,
      monaco,
      setCompilerResult,
      setImportMap,
      tailwindcss,
    ],
  );

  useEffect(() => {
    // call handleChange with the rebuilt model when esbuild is initialized
    if (initialized && rebuildRef.current.length > 0) {
      logger.debug('esbuild initialized, rebuilding models');
      rebuildRef.current.forEach(model => {
        handleChange(model);
      });
      rebuildRef.current = [];
      logger.debug('Rebuilt models');
    }
  }, [handleChange, initialized]);

  useEffect(() => {
    if (esbuildStarted) {
      return;
    }
    resetSize();
    esbuildStarted = true;
    async function importAndRunEsbuildOnMount() {
      const promises: Promise<void>[] = [];
      promises.push(
        initialize({
          wasmURL: esbuildUrl,
          worker: true,
        }),
      );
      if ('serviceWorker' in navigator) {
        promises.push(
          navigator.serviceWorker
            .register('/service-worker.js', {
              type: 'module',
              scope: '/',
            })
            .then(registration => {
              logger.debug('Service worker registered', registration);
            }),
        );

        // Wait for the service worker to take control
        if (!navigator.serviceWorker.controller) {
          logger.debug('Waiting for service worker...');
          await new Promise<void>(resolve => {
            let resolved = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              logger.debug('Service worker now controlling the page');
              resolved = true;
              resolve();
            });

            setTimeout(() => {
              // if force refreshing, idk weird stuff happens
              // and the service worker doesn't take control
              if (!resolved) {
                logger.warn('Service worker not controlling the page');
                resolve();
              }
            }, 1000);
          });
        }
      }
      await Promise.all(promises);
      setInitialized(true);
      esbuildInitialized = true;
      logger.debug('esbuild initialized');
    }
    importAndRunEsbuildOnMount();
    window.addEventListener('resize', () => resetSize());
  }, [handleChange]);

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

  function resetSize(w = wPercentRef.current, h = hPercentRef.current) {
    if (parentRef.current) {
      wPercentRef.current = w;
      setLeft(parentRef.current.offsetWidth * w - lineWidth / 2);
      setRight(parentRef.current.offsetWidth * (1 - w) - lineWidth / 2);

      hPercentRef.current = h;
      setHeight(window.innerHeight * h - lineWidth);
      resizeCbRef.current();
    }
  }

  function onWMouseMove(e: MouseEvent) {
    if (parentRef.current) {
      const p = e.clientX / parentRef.current.offsetWidth;
      resetSize(p);
    }
  }

  function onWMouseUp() {
    document.removeEventListener('mousemove', onWMouseMove);
    document.removeEventListener('mouseup', onWMouseUp);
  }

  function onHMouseMove(e: MouseEvent) {
    const p = e.clientY / (window.innerHeight - lineWidth);
    resetSize(undefined, p);
  }

  function onHMouseUp() {
    document.removeEventListener('mousemove', onHMouseMove);
    document.removeEventListener('mouseup', onHMouseUp);
  }

  return (
    <>
      <Toaster position="top-right" theme="dark" />
      <div
        className="flex w-full flex-row items-stretch overflow-hidden"
        ref={parentRef}
        style={{
          height: height === 0 ? `calc(100vh - ${lineWidth}px)` : height,
        }}
      >
        <div
          style={{
            width: left === 0 ? `calc(50% - ${lineWidth / 2}px)` : left,
          }}
        >
          <MonacoEditors
            resizeCbRef={resizeCbRef}
            handleChange={handleChange}
            defaultModels={[
              {
                value: DEFAULT_TSX,
                filename: 'main.tsx',
                language: 'typescript',
              },
              {
                value: DEFAULT_CSS,
                filename: 'main.css',
                language: 'css',
              },
            ]}
          />
        </div>
        <div
          className="outline-wihte relative z-10 cursor-col-resize bg-[#18181B] outline-0 outline-white transition-all hover:outline-4 active:outline-4"
          style={{
            width: lineWidth,
          }}
          onMouseDown={e => {
            e.preventDefault();
            document.addEventListener('mousemove', onWMouseMove);
            document.addEventListener('mouseup', onWMouseUp);
          }}
        />
        <div
          className="flex flex-col"
          style={{
            width: right === 0 ? `calc(50% - ${lineWidth / 2}px)` : right,
          }}
        >
          <Result />
        </div>
      </div>
      <div
        className="relative z-20 cursor-row-resize bg-[#18181B] outline-0 outline-white transition-all hover:outline-4 active:outline-4"
        style={{
          height: lineWidth,
        }}
        onMouseDown={e => {
          e.preventDefault();
          document.addEventListener('mousemove', onHMouseMove);
          document.addEventListener('mouseup', onHMouseUp);
        }}
      />

      <div className="fixed right-4 bottom-4 flex h-10">
        <button
          onClick={saveProject}
          className="mr-2 flex aspect-square cursor-pointer items-center justify-center rounded-full bg-gray-800/10 text-sm text-white outline outline-white/30 hover:bg-gray-800/20"
        >
          <svg
            width="2em"
            height="2em"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
          >
            <path
              fill="white"
              d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z"
            />
          </svg>
        </button>
        <button
          className="cursor-pointer rounded bg-gray-800/10 px-4 text-sm text-white outline outline-white/30 hover:bg-gray-800/20"
          onClick={() => {
            const key = prompt(
              'Enter your Auth Key (you can leave this empty to remove it):',
            );
            if (key !== null) {
              setAuthKey(key?.trim() === '' ? null : key);
            }
          }}
        >
          {authKey ? 'Change' : 'Set'} Auth Key
        </button>
      </div>
    </>
  );
}
