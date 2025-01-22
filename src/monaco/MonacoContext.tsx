import type * as m from "monaco-editor";
import { MonacoTailwindcss } from "monaco-tailwindcss";
import { createContext } from "react";

export const MonacoContext = createContext<{
  monaco: typeof m | null;
  tailwindcss: MonacoTailwindcss | null;
  tailwindEnabled: boolean;
  setTailwindEnabled: (enabled: boolean) => void;
  classList: string[];
  setClassList: (classList: string[]) => void;
}>({
  monaco: null,
  tailwindcss: null,
  tailwindEnabled: false,
  setTailwindEnabled: () => {},
  classList: [],
  setClassList: () => {},
});
