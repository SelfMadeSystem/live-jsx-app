import type * as m from 'monaco-editor';
import { MonacoContext } from './MonacoContext';
import { MonacoEditorsContext } from './MonacoEditorsContext';
import { useState } from 'react';
import { useContext, useEffect, useRef } from 'react';

export function MonacoEditors({
  children,
  resizeCbRef,
}: {
  children: React.ReactNode;
  resizeCbRef: React.MutableRefObject<() => void>;
}) {
  const [editor, setEditor] = useState<m.editor.IStandaloneCodeEditor | null>(
    null,
  );
  const [models, setModels] = useState<m.editor.ITextModel[]>([]);
  const divRef = useRef<HTMLDivElement | null>(null);
  const { monaco /* , tailwindEnabled */ } = useContext(MonacoContext);
  const [, updateState] = useState({});
  const forceUpdate = () => updateState({});

  function addModel(model: m.editor.ITextModel) {
    setModels(prev => [...prev, model]);
  }

  function removeModel(model: m.editor.ITextModel) {
    setModels(prev => prev.filter(m => m !== model));
  }

  useEffect(() => {
    if (!monaco || editor) return;

    const newEditor = monaco.editor.create(divRef.current!, {
      wordWrap: 'on',
      theme: 'vs-dark',
      automaticLayout: true,
    });

    newEditor.setModel(null);
    setEditor(newEditor);
    resizeCbRef.current = () => newEditor.layout();

    return () => {
      newEditor.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monaco]);

  // useEffect(() => {
  //   if (!monaco || !editor || tailwindEnabled) return;

  //   // Remove all existing decorations
  //   for (const model of models) {
  //     const decorations = model.getAllDecorations();
  //     editor.removeDecorations(decorations.map(d => d.id));
  //   }
  // }, [editor, models, monaco, tailwindEnabled]);

  const currentModel = editor?.getModel();

  return (
    <MonacoEditorsContext.Provider
      value={{ editor, models, addModel, removeModel }}
    >
      <div className="flex h-full flex-col">
        <div className="flex w-full flex-row bg-[#1e1e1e] text-white">
          {models.map(model => (
            <button
              className={`${model === currentModel ? 'bg-gray-800' : ''} cursor-pointer px-4 py-2`}
              key={model.uri.toString()}
              onClick={() => {
                editor?.setModel(model);
                forceUpdate();
              }}
            >
              {model.uri.path.split('/').pop()}
            </button>
          ))}
        </div>
        <div ref={divRef} className="h-full">
          {children}
        </div>
      </div>
    </MonacoEditorsContext.Provider>
  );
}
