import { MonacoContext } from '../monaco/MonacoContext';
import { usePrevious } from '../utils';
import { ErrorBoundary } from './ErrorBoundary';
import { CSS_PRELUDE } from './ShadowDomConsts';
import { createElement, useContext, useEffect, useRef } from 'react';
import ReactDOMClient from 'react-dom/client';

export function ShadowDomCreator({ css, js }: { css: string; js: string }) {
  const { setShowErrors } = useContext(MonacoContext);
  const prevCss = usePrevious(css);
  const prevJs = usePrevious(js);
  const previewRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReactDOMClient.Root | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const shadowRoot = useRef<ShadowRoot | null>(null);
  const willRerender = useRef(false);

  useEffect(() => {
    if (!previewRef.current) {
      return;
    }
    willRerender.current = false;

    const controller = new AbortController();
    const { signal } = controller;

    function renderDom(js: string, css: string) {
      if (signal.aborted) {
        return;
      }
      if (!previewRef.current) {
        return;
      }
      const jsDiff = js !== prevJs;
      const cssDiff = css !== prevCss;
      // Create the shadow root if it doesn't exist
      if (!shadowRoot.current) {
        shadowRoot.current = previewRef.current.attachShadow({ mode: 'open' });
      }
      // Create the ReactDOM root if it doesn't exist
      if (!rootRef.current) {
        rootRef.current = ReactDOMClient.createRoot(shadowRoot.current);
        rootRef.current.render(
          <div>
            Loading...
          </div>
        );
      }

      if (jsDiff) {
        willRerender.current = true;
        // Create a blob to load the JS from
        const data = new TextEncoder().encode(js);
        const blob = new Blob([data], { type: 'application/javascript' });

        const url = URL.createObjectURL(blob);

        // Import the JS from the blob
        import(/* @vite-ignore */ url).then(module => {
          if (
            (signal.aborted && willRerender.current) ||
            !rootRef.current ||
            !module.default
          ) {
            return;
          }

          const root = rootRef.current;
          try {
            // Render the React component
            // Unique key to force re-render
            root.render(
              <ErrorBoundary setShowErrors={setShowErrors} key={js}>
                {createElement(module.default)}
              </ErrorBoundary>,
            );
          } catch (e) {
            console.error(e);
          }
        }).catch(e => {
          console.error(e);
          setShowErrors(true);
        });

        signal.addEventListener('abort', () => {
          URL.revokeObjectURL(url);
        });
      }

      if (cssDiff) {
        // Create a style element and append it to the shadow root
        const style = styleRef.current ?? document.createElement('style');
        style.textContent = CSS_PRELUDE + css;
        if (!styleRef.current || !shadowRoot.current.parentElement)
          shadowRoot.current.appendChild((styleRef.current = style));
      }
    }

    renderDom(js, css);

    return () => {
      controller.abort();
    };
  }, [css, js, prevJs, prevCss, setShowErrors]);

  return (
    <>
      <div
        className="isolate flex h-full w-full grow transform-cpu items-center justify-center overflow-hidden"
        ref={previewRef}
      ></div>
    </>
  );
}
