import type * as m from 'monaco-editor';
import { CompilerResult } from '../compiler/compilerResult';
import { TailwindHandler } from '../tailwind/TailwindHandler';
import { Message } from 'console-feed/lib/definitions/Component';
import { createContext } from 'react';

export const MonacoContext = createContext<{
  monaco: typeof m | null;
  tailwindcss: TailwindHandler | null;
  importMap: Record<string, string>;
  setImportMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  compilerResultRef: { readonly current: CompilerResult };
  compilerResult: CompilerResult;
  setCompilerResult: (result: CompilerResult) => void;
  logs: Message[];
  setLogs: (logs: Message[]) => void;
  clearLogs: () => void;
}>({
  monaco: null,
  tailwindcss: null,
  importMap: {},
  setImportMap: () => {},
  compilerResultRef: { current: {} as CompilerResult },
  compilerResult: {} as CompilerResult,
  setCompilerResult: () => {},
  logs: [],
  setLogs: () => {},
  clearLogs: () => {},
});
