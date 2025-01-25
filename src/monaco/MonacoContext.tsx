import type * as m from 'monaco-editor';
import { createContext } from 'react';
import { TailwindHandler } from '../tailwind/TailwindHandler';

export const MonacoContext = createContext<{
  monaco: typeof m | null;
  tailwindcss: TailwindHandler | null;
  tailwindEnabled: boolean;
  setTailwindEnabled: (enabled: boolean) => void;
  classList: Set<string>;
}>({
  monaco: null,
  tailwindcss: null,
  tailwindEnabled: false,
  setTailwindEnabled: () => {},
  classList: new Set(),
});
