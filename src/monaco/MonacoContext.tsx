import type * as m from 'monaco-editor';
import {
  CompilerResult,
  defaultCompilerResult,
} from '../compiler/compilerResult';
import { Message } from 'console-feed/lib/definitions/Component';
import { TailwindHandler } from 'monaco-tailwind/TailwindHandler';
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
  showErrors: boolean;
  setShowErrors: (showErrors: boolean) => void;
}>({
  monaco: null,
  tailwindcss: null,
  importMap: {},
  setImportMap: () => {},
  compilerResultRef: { current: structuredClone(defaultCompilerResult) },
  compilerResult: structuredClone(defaultCompilerResult),
  setCompilerResult: () => {},
  logs: [],
  setLogs: () => {},
  clearLogs: () => {},
  showErrors: false,
  setShowErrors: () => {},
});
