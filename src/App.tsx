import { Result } from './Result';
import { compile } from './compiler/compilerResult';
import { DEFAULT_CSS, DEFAULT_TSX } from './consts';
import { MonacoContext } from './monaco/MonacoContext';
import { MonacoEditor } from './monaco/MonacoEditor';
import { MonacoEditors } from './monaco/MonacoEditors';
import initSwc from '@swc/wasm-web';
import swcWasm from '@swc/wasm-web/wasm_bg.wasm?url';
import type { Message } from 'console-feed/lib/definitions/Component';
import { useContext, useEffect, useRef, useState } from 'react';

let swcStarted = false;
let swcInitialized = false;

export default function App() {
  const { compilerResult, setCompilerResult, tailwindcss } = useContext(MonacoContext);
  const [logs, setLogs] = useState<Message[]>([]);
  const parentRef = useRef<HTMLDivElement>(null);
  const lineWidth = 4;
  const hPercentRef = useRef(1);
  const wPercentRef = useRef(0.5);
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
  const [height, setHeight] = useState(0);
  const resizeCbRef = useRef<() => void>(() => {});

  const [initialized, setInitialized] = useState(swcInitialized);

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
      const newResult = await compile(
        DEFAULT_TSX,
        DEFAULT_CSS,
        compilerResult,
        {
          tailwindHandler: tailwindcss,
        },
      );
      setCompilerResult(newResult);
    }
    importAndRunSwcOnMount();
    window.addEventListener('resize', () => resetSize());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleChange({ tsx, css }: { tsx?: string; css?: string }) {
    if (!initialized) {
      return;
    }

    const newResult = await compile(
      tsx ?? compilerResult.tsx,
      css ?? compilerResult.css,
      compilerResult,
      {
        tailwindHandler: tailwindcss,
      },
    );

    setCompilerResult(newResult);
  }

  function resetSize(w = wPercentRef.current, h = hPercentRef.current) {
    if (parentRef.current) {
      wPercentRef.current = w;
      setLeft(parentRef.current.offsetWidth * w - lineWidth / 2);
      setRight(parentRef.current.offsetWidth * (1 - w) - lineWidth / 2);

      hPercentRef.current = h;
      setHeight(window.innerHeight * h);
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
    const p = e.clientY / window.innerHeight;
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
          <MonacoEditors resizeCbRef={resizeCbRef}>
            <MonacoEditor
              value={DEFAULT_TSX}
              filename="main.tsx"
              language="typescript"
              onChange={s => handleChange({ tsx: s })}
            />
            <MonacoEditor
              value={DEFAULT_CSS}
              filename="main.css"
              language="css"
              onChange={s => handleChange({ css: s })}
            />
          </MonacoEditors>
        </div>
        <div
          className="relative z-10 cursor-col-resize bg-gray-200 outline-0 outline-blue-600 transition-all hover:outline-4 active:outline-4"
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
          <div className="text-center text-lg font-bold">Output:</div>
          <Result logs={logs} setLogs={setLogs} />
        </div>
      </div>
      <div
        className="relative z-20 cursor-row-resize bg-gray-200 outline-0 outline-blue-600 transition-all hover:outline-4 active:outline-4"
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
