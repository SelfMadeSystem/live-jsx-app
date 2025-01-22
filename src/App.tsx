import { CompilerResult, Result } from './Result';
import { MonacoEditor } from './monaco/MonacoEditor';
import { MonacoProvider } from './monaco/MonacoProvider';
import initSwc from '@swc/wasm-web';
import swcWasm from '@swc/wasm-web/wasm_bg.wasm?url';
import type { Message } from 'console-feed/lib/definitions/Component';
import { useEffect, useState } from 'react';
import { transformTsx } from './parsy';

export default function App() {
  const [result, setResult] = useState<CompilerResult>({
    code: '',
  });
  const [logs, setLogs] = useState<Message[]>([]);

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function importAndRunSwcOnMount() {
      await initSwc(swcWasm);
      setInitialized(true);
    }
    importAndRunSwcOnMount();
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

  return (
    <MonacoProvider>
      <div className="mx-auto max-w-7xl p-4">
        <div className="text-lg font-bold">SWC Playground</div>
        <div className="h-64">
          <MonacoEditor language="typescript" jsx onChange={handleChange} />
        </div>
        <div className="text-lg font-bold">Output:</div>
        <Result result={result} logs={logs} setLogs={setLogs} />
      </div>
    </MonacoProvider>
  );
}
