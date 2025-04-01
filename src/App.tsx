import type * as m from 'monaco-editor';
import { Result } from './Result';
import { abortSymbol, compile } from './compiler/compilerResult';
import { DEFAULT_CSS, DEFAULT_TSX } from './consts';
import { createLogger } from './logger';
import { MonacoContext } from './monaco/MonacoContext';
import { MonacoEditors } from './monaco/MonacoEditors';
import initSwc from '@swc/wasm-web';
import swcWasm from '@swc/wasm-web/wasm_bg.wasm?url';
import { Hook, Unhook } from 'console-feed';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';

const logger = createLogger('App');

let swcStarted = false;
let swcInitialized = false;

export default function App() {
  const {
    compilerResult,
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

  const [initialized, setInitialized] = useState(swcInitialized);
  const [twInitialized, setTwInitialized] = useState(false);
  const rebuildRef = useRef<m.editor.ITextModel | null>(null);

  const handleChange = useCallback(
    async (model: m.editor.ITextModel) => {
      if (!initialized) {
        logger.debug('SWC not initialized yet');
        rebuildRef.current = model; // rebuild when swc is initialized
        return;
      }
      logger.info('Model changed', model.uri.path);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const prevResult = compilerResultRef.current;

      if (model.uri.path.endsWith('main.tsx')) {
        compilerResultRef.current.newTsx = model.getValue();
      } else if (model.uri.path.endsWith('main.css')) {
        compilerResultRef.current.newCss = model.getValue();
      } else {
        const filename = model.uri.path.split('/').pop();
        if (filename) {
          if (!compilerResultRef.current.tsFiles[filename]) {
            compilerResultRef.current.tsFiles[filename] = {
              filename: filename,
              contents: '',
              newContents: model.getValue(),
              builtJs: '',
              success: false,
              module: null,
              objectUrl: '',
              transformedJs: '',
              classList: [],
            };
          } else {
            compilerResultRef.current.tsFiles[filename].newContents =
              model.getValue();
          }
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

      if (prevResult.transformedJs !== newResult.transformedJs) {
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
    if (swcStarted) {
      return;
    }
    resetSize();
    swcStarted = true;
    async function importAndRunSwcOnMount() {
      await initSwc(swcWasm);
      setInitialized(true);
      swcInitialized = true;
      logger.debug('SWC initialized');

      if (rebuildRef.current) {
        logger.debug('Rebuilding after SWC initialized');
        handleChange(rebuildRef.current);
        rebuildRef.current = null;
      }
    }
    importAndRunSwcOnMount();
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

  useEffect(() => {
    if (!initialized || twInitialized || !tailwindcss) {
      return;
    }

    // First compile after tailwind is initialized

    setTwInitialized(true);
    // this probably doesn't actually need to exist ngl
  }, [
    clearLogs,
    compilerResult,
    initialized,
    setCompilerResult,
    tailwindcss,
    twInitialized,
  ]);

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
      <div
        className="flex w-full flex-row items-stretch overflow-hidden"
        ref={parentRef}
        style={{ height }}
      >
        <div style={{ width: left }}>
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
        <div className="flex flex-col" style={{ width: right }}>
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
