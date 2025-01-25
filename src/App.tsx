import { CompilerResult, Result } from './Result';
import { DEFAULT_CSS, DEFAULT_TSX } from './consts';
import { MonacoEditor } from './monaco/MonacoEditor';
import { MonacoEditors } from './monaco/MonacoEditors';
import { MonacoProvider } from './monaco/MonacoProvider';
import { transformTsx } from './parsy';
import initSwc from '@swc/wasm-web';
import swcWasm from '@swc/wasm-web/wasm_bg.wasm?url';
import type { Message } from 'console-feed/lib/definitions/Component';
import { useEffect, useRef, useState } from 'react';

let swcStarted = false;
let swcInitialized = false;

export default function App() {
  const [result, setResult] = useState<CompilerResult>({
    code: '',
    classList: new Set(),
  });
  const [css, setCss] = useState(DEFAULT_CSS);
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
      const newResult = await transformTsx(DEFAULT_TSX);
      if (newResult.code !== undefined) {
        setLogs([]);
      }
      setResult(newResult);
    }
    importAndRunSwcOnMount();
    window.addEventListener('resize', () => resetSize());
  }, []);

  async function handleChange(code: string) {
    if (!initialized) {
      return;
    }
    const newResult = await transformTsx(code);
    if (newResult.code !== undefined && newResult.code !== result.code) {
      setLogs([]);
    }
    setResult(newResult);
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
    <MonacoProvider classList={result.classList || new Set()}>
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
              onChange={handleChange}
            />
            <MonacoEditor
              value={DEFAULT_CSS}
              filename="main.css"
              language="css"
              onChange={setCss}
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
          <Result css={css} result={result} logs={logs} setLogs={setLogs} />
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
    </MonacoProvider>
  );
}
