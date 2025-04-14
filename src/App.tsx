import type * as m from 'monaco-editor';
import { Result } from './Result';
import { abortSymbol, compile } from './compiler/compilerResult';
import { DEFAULT_CSS, DEFAULT_TSX } from './consts';
import { createLogger } from './logger';
import { MonacoContext } from './monaco/MonacoContext';
import { MonacoEditors } from './monaco/MonacoEditors';
import { Hook, Unhook } from 'console-feed';
import { initialize } from 'esbuild-wasm';
import esbuildUrl from 'esbuild-wasm/esbuild.wasm?url';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Toaster } from 'sonner';

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
  const resizeCbRef = useRef<() => void>(() => {});

  const [initialized, setInitialized] = useState(esbuildInitialized);
  const rebuildRef = useRef<m.editor.ITextModel[]>([]);

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
    </>
  );
}
