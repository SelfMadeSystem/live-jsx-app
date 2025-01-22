import { CompilerResult, Result } from './Result';
import { MonacoEditor } from './monaco/MonacoEditor';
import { MonacoProvider } from './monaco/MonacoProvider';
import initSwc, { transform } from '@swc/wasm-web';
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
    const newResult = await transform(code, {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true,
          decorators: true,
        },
        target: 'es2020',
      },
      isModule: true,
    }).catch(e => {
      // typeof e === 'string' for some reason
      // eslint-disable-next-line no-control-regex
      const eWithoutAnsi = e.replace(/\u001b\[\d+m/g, '');
      setLogs([
        {
          data: [eWithoutAnsi],
          id: '0',
          method: 'error',
        },
      ]);
      setResult({ error: e });
      return undefined;
    });
    if (!newResult) {
      return;
    }
    if (newResult.code !== result.code) {
      setLogs([]);
      setResult({ code: newResult.code });
    }
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
