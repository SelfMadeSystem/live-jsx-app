import type * as m from 'monaco-editor';
import { createContext } from 'react';

export const MonacoEditorsContext = createContext<{
  editor: m.editor.IStandaloneCodeEditor | null;
  models: m.editor.ITextModel[];
  addModel: (model: m.editor.ITextModel) => void;
  removeModel: (model: m.editor.ITextModel) => void;
}>({
  editor: null,
  models: [],
  addModel: () => {},
  removeModel: () => {},
});
