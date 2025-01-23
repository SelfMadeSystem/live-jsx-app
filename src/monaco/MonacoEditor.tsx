import * as m from 'monaco-editor';
import { MonacoContext } from './MonacoContext';
import { MonacoEditorsContext } from './MonacoEditorsContext';
import { useContext, useEffect, useRef } from 'react';

export function MonacoEditor({
  value,
  filename,
  onChange,
  language,
}: {
  value?: string;
  filename: string;
  onChange: (value: string) => void;
  language: string;
}) {
  const { editor, addModel } = useContext(MonacoEditorsContext);
  const modelRef = useRef<m.editor.ITextModel | null>(null);
  const { monaco } = useContext(MonacoContext);

  useEffect(() => {
    if (!monaco || !editor || modelRef.current) return;

    const modelUri = monaco.Uri.file(filename);
    const model = monaco.editor.createModel(value ?? '', language, modelUri);

    if (editor.getModel() === null) editor.setModel(model);

    model.onDidChangeContent(() => {
      onChange(model.getValue());
    });

    addModel(model);
    modelRef.current = model;
  }, [addModel, editor, filename, language, monaco, onChange, value]);

  return null;
}
