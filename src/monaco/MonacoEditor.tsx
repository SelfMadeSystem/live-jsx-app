import type * as m from 'monaco-editor';
import { MonacoContext } from './MonacoContext';
import { useContext, useEffect, useRef } from 'react';

export function MonacoEditor({
  value,
  onChange,
  language,
  readOnly,
  jsx,
}: {
  value?: string;
  onChange: (value: string) => void;
  language: string;
  readOnly?: boolean;
  jsx?: boolean;
}) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<m.editor.IStandaloneCodeEditor | null>(null);
  const { monaco, tailwindEnabled } = useContext(MonacoContext);

  useEffect(() => {
    if (!monaco || editorRef.current) return;

    let model;
    if (jsx) {
      const modelUri = monaco.Uri.file('main.tsx');
      model = monaco.editor.createModel(value ?? '', language, modelUri);
    }

    editorRef.current = monaco.editor.create(divRef.current!, {
      value,
      language,
      readOnly,
      automaticLayout: true,
      wordWrap: 'on',
      theme: 'vsc2',
    });

    if (model) {
      editorRef.current.setModel(model);
    }

    editorRef.current.onDidChangeModelContent(() => {
      onChange(editorRef.current!.getValue());
    });

    return () => {
      editorRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, monaco, readOnly, value]);

  useEffect(() => {
    if (!monaco || !editorRef.current) return;

    if (value !== undefined && value !== editorRef.current.getValue()) {
      console.log('Setting value');
      editorRef.current.setValue(value);
    }
  }, [monaco, value]);

  useEffect(() => {
    if (!monaco || !editorRef.current || tailwindEnabled) return;

    // Remove all existing decorations
    const model = editorRef.current.getModel();
    if (!model) return;

    const decorations = model.getAllDecorations();
    editorRef.current.removeDecorations(decorations.map(d => d.id));
  }, [monaco, tailwindEnabled]);

  return <div ref={divRef} style={{ height: '100%' }} />;
}
