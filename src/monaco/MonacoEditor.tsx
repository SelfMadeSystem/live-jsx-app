import * as m from 'monaco-editor';
import { debounce } from '../utils';
import { MonacoContext } from './MonacoContext';
import { MonacoEditorsContext } from './MonacoEditorsContext';
import { useContext, useEffect, useMemo, useRef } from 'react';

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
  const onChangeRef = useRef(onChange);

  const saveToLocalStorage = useMemo(
    () =>
      debounce((model: m.editor.ITextModel) => {
        const modelData = {
          value: model.getValue(),
          language: model.getLanguageId(),
          uri: model.uri.toString(),
        };
        localStorage.setItem(
          `monacoModel-${filename}`,
          JSON.stringify(modelData),
        );
      }, 1000),
    [filename],
  );

  useEffect(() => {
    if (!monaco || !editor || modelRef.current) return;

    const modelUri = monaco.Uri.file(filename);
    const savedModel = localStorage.getItem(`monacoModel-${filename}`);
    let model: m.editor.ITextModel;

    if (savedModel) {
      const parsedModel = JSON.parse(savedModel);
      model = monaco.editor.createModel(
        parsedModel.value,
        parsedModel.language,
        modelUri,
      );
    } else {
      model = monaco.editor.createModel(value ?? '', language, modelUri);
    }

    if (editor.getModel() === null) editor.setModel(model);

    model.onDidChangeContent(() => {
      onChangeRef.current(model.getValue());
      saveToLocalStorage(model);
    });

    addModel(model);
    modelRef.current = model;

    onChangeRef.current(model.getValue());
  }, [addModel, editor, filename, language, monaco, saveToLocalStorage, value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  return null;
}
