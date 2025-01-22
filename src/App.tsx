import { CompilerResult, Result } from './Result';
import { MonacoEditor } from './monaco/MonacoEditor';
import { MonacoProvider } from './monaco/MonacoProvider';
import { transformTsx } from './parsy';
import initSwc from '@swc/wasm-web';
import swcWasm from '@swc/wasm-web/wasm_bg.wasm?url';
import type { Message } from 'console-feed/lib/definitions/Component';
import { useEffect, useState } from 'react';

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
      <div className="flex min-h-screen w-full flex-row">
        <div className="w-1/2">
          <MonacoEditor language="typescript" jsx onChange={handleChange} />
        </div>
        <div className="flex w-1/2 flex-col">
          <div className="text-center text-lg font-bold">Output:</div>
          <Result result={result} logs={logs} setLogs={setLogs} />
        </div>
      </div>
    </MonacoProvider>
  );
}
