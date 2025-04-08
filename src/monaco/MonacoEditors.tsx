import type * as m from 'monaco-editor';
import { createLogger } from '../logger';
import { debounce, isValidFilename } from '../utils';
import { MonacoContext } from './MonacoContext';
import { useCallback, useState } from 'react';
import { useContext, useEffect, useRef } from 'react';

const logger = createLogger('MonacoEditors');

const defaultOptions = {
  tabSize: 2,
  insertSpaces: true,
  trimAutoWhitespace: true,
};

type SavedModel = {
  value: string;
  filename: string;
  language: string;
};

function getSavedModel(filename: string): SavedModel | null {
  const savedModel = localStorage.getItem(`monacoModel-${filename}`);
  if (savedModel) {
    const parsedModel = JSON.parse(savedModel);
    return {
      value: parsedModel.value,
      filename: parsedModel.filename,
      language: parsedModel.language,
    };
  }
  return null;
}

function modelToSavedModel(
  filename: string,
  model: m.editor.ITextModel,
): SavedModel {
  return {
    value: model.getValue(),
    filename: filename,
    language: model.getLanguageId(),
  };
}

function saveModelToLocalStorage(filename: string, model: m.editor.ITextModel) {
  const modelData = modelToSavedModel(filename, model);
  localStorage.setItem(`monacoModel-${filename}`, JSON.stringify(modelData));
}

function getModelListFromLocalStorage(): string[] {
  const modelList = localStorage.getItem('monacoModelList');
  if (modelList) {
    const parsedModelList = JSON.parse(modelList);
    return parsedModelList;
  }
  return [];
}

function saveModelListToLocalStorage(modelNames: string[]) {
  localStorage.setItem('monacoModelList', JSON.stringify(modelNames));
}

function getSavedModelsFromLocalStorage(): Record<string, SavedModel> {
  const modelList = getModelListFromLocalStorage();
  const savedModels: Record<string, SavedModel> = {};
  for (const filename of modelList) {
    const savedModel = getSavedModel(filename);
    if (savedModel) {
      savedModels[filename] = savedModel;
    }
  }
  return savedModels;
}

export function MonacoEditors({
  resizeCbRef,
  defaultModels,
  handleChange,
}: {
  resizeCbRef: React.RefObject<() => void>;
  defaultModels: SavedModel[];
  handleChange: (model: m.editor.ITextModel) => void;
}) {
  const [editor, setEditor] = useState<m.editor.IStandaloneCodeEditor | null>(
    null,
  );
  const [models, setModels] = useState<m.editor.ITextModel[]>([]);
  const divRef = useRef<HTMLDivElement | null>(null);
  const { monaco } = useContext(MonacoContext);
  const [, updateState] = useState({});
  const forceUpdate = () => updateState({});
  const handleChangeRef = useRef(handleChange);
  handleChangeRef.current = handleChange;

  const addModel = useCallback(
    (
      model: m.editor.ITextModel,
      newEditor?: m.editor.IStandaloneCodeEditor,
    ) => {
      model.updateOptions(defaultOptions);
      const filename = model.uri.path.substring(1);
      const saveModel = debounce(() => {
        saveModelToLocalStorage(filename, model);
      }, 1000);
      (editor ?? newEditor)!.onDidChangeModelContent(() => {
        handleChangeRef.current(model);
        saveModel();
      });
      setModels(prev => {
        const newModelList = [...prev, model];
        const modelNames = newModelList.map(m => m.uri.path.substring(1));
        saveModelListToLocalStorage(modelNames);
        logger.debug('Added model', filename);
        return newModelList;
      });
    },
    [editor],
  );

  const removeModel = useCallback((model: m.editor.ITextModel) => {
    setModels(prev => {
      const newModelList = prev.filter(m => m !== model);
      const modelNames = newModelList.map(m => m.uri.path.split('/').pop()!);
      saveModelListToLocalStorage(modelNames);
      logger.debug('Removed model', model.uri.path);
      return newModelList;
    });
  }, []);

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
    const defaultModelsRecord = defaultModels.reduce(
      (acc, model) => {
        acc[model.filename] = model;
        return acc;
      },
      {} as Record<string, SavedModel>,
    );
    const models = {
      ...defaultModelsRecord,
      ...getSavedModelsFromLocalStorage(),
    };

    for (const modelName in models) {
      const model = models[modelName];
      const { value, filename, language } = model;
      const modelUri = monaco.Uri.file(filename);
      const newModel = monaco.editor.createModel(value, language, modelUri);
      addModel(newModel, newEditor);
      handleChange(newModel);
      if (newEditor.getModel() === null) newEditor.setModel(newModel);
    }
    logger.debug('Loaded models', models);
    logger.debug('Editor created', newEditor);

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
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      <div className="flex w-full flex-row overflow-x-auto overflow-y-hidden text-white">
        {models.map(model => (
          <div
            key={model.uri.toString()}
            className={`flex items-center pr-2 hover:bg-[#252525] ${model === currentModel ? '!bg-gray-800' : ''}`}
          >
            <button
              className="cursor-pointer py-2 pl-2"
              onClick={() => {
                editor?.setModel(model);
                forceUpdate();
              }}
            >
              {model.uri.path.substring(1)}
            </button>
            {model.uri.path.substring(1) === 'main.tsx' ||
            model.uri.path.substring(1) === 'main.css' ? null : (
              <button
                className="ml-2 flex cursor-pointer justify-center rounded-full px-1 py-1 hover:bg-[#fff1]"
                onClick={() => {
                  if (!confirm('Are you sure you want to delete this file?'))
                    return;
                  if (model === currentModel) editor?.setModel(null);
                  removeModel(model);
                  model.dispose();
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M13.46,12L19,17.54V19H17.54L12,13.46L6.46,19H5V17.54L10.54,12L5,6.46V5H6.46L12,10.54L17.54,5H19V6.46L13.46,12Z" />
                </svg>
              </button>
            )}
          </div>
        ))}
        <button
          className="my-auto ml-2 h-fit w-fit cursor-pointer rounded-full px-2 py-2 text-white hover:bg-[#fff1]"
          onClick={() => {
            let newName = prompt('Enter new name for the file:');
            if (!newName) return;

            newName = newName.trim();
            newName = newName.replace(/\\/g, '/'); // Replace backslashes with forward slashes
            newName = newName.replace(/^\//, ''); // Strip leading `/` if present
            if (!isValidFilename(newName || '')) {
              alert('Invalid name');
              return;
            }
            const newModel = monaco?.editor.createModel(
              '',
              'typescript',
              monaco?.Uri.parse(`file:///${newName}.tsx`),
            );
            if (!newModel) return;
            addModel(newModel);
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M14 2H6C4.89 2 4 2.89 4 4V20C4 21.11 4.89 22 6 22H13.81C13.28 21.09 13 20.05 13 19C13 15.69 15.69 13 19 13C19.34 13 19.67 13.03 20 13.08V8L14 2M13 9V3.5L18.5 9H13M23 20H20V23H18V20H15V18H18V15H20V18H23V20Z" />
          </svg>
        </button>
      </div>
      <div ref={divRef} className="h-full"></div>
    </div>
  );
}
