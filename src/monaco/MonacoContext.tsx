import type * as m from 'monaco-editor';
import { CompilerResult } from '../compiler/compilerResult';
import { TailwindHandler } from '../tailwind/TailwindHandler';
import { createContext } from 'react';

export const MonacoContext = createContext<{
  monaco: typeof m | null;
  tailwindcss: TailwindHandler | null;
  tailwindEnabled: boolean;
  setTailwindEnabled: (enabled: boolean) => void;
  compilerResultRef: { readonly current: CompilerResult };
  compilerResult: CompilerResult;
  setCompilerResult: (result: CompilerResult) => void;
}>({
  monaco: null,
  tailwindcss: null,
  tailwindEnabled: false,
  setTailwindEnabled: () => {},
  compilerResultRef: { current: {} as CompilerResult },
  compilerResult: {} as CompilerResult,
  setCompilerResult: () => {},
});
