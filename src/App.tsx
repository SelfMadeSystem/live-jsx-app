import { useState, useEffect } from "react";
import initSwc, { transform } from "@swc/wasm-web";
import swcWasm from "@swc/wasm-web/wasm_bg.wasm?url";
import { CompilerResult, Result } from "./Result";
import type { Message } from "console-feed/lib/definitions/Component";

export default function App() {
  const [result, setResult] = useState<CompilerResult>({
    code: "",
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

  async function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (!initialized) {
      return;
    }
    const code = e.target.value;
    const newResult = await transform(code, {
      jsc: {
        parser: {
          syntax: "typescript",
          tsx: true,
          decorators: true,
        },
        target: "es2020",
      },
      isModule: true,
    }).catch((e) => {
      // typeof e === 'string' for some reason
      // eslint-disable-next-line no-control-regex
      const eWithoutAnsi = e.replace(/\u001b\[\d+m/g, "");
      setLogs([
        {
          data: [eWithoutAnsi],
          id: "0",
          method: "error",
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
    <div className="max-w-7xl mx-auto p-4">
      <div className="text-lg font-bold">SWC Playground</div>
      <textarea
        onChange={handleChange}
        className="w-full h-48 min-h-12 resize-y bg-gray-100 p-2"
      />
      <div className="text-lg font-bold">Output:</div>
      <Result result={result} logs={logs} setLogs={setLogs} />
    </div>
  );
}
