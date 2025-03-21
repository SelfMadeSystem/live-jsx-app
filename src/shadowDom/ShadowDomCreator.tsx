import { usePrevious } from '../utils';
import { CSS_PRELUDE } from './ShadowDomConsts';
import { createElement, useEffect, useRef } from 'react';
import ReactDOMClient from 'react-dom/client';

export function ShadowDomCreator({ css, js }: { css: string; js: string }) {
  const prevCss = usePrevious(css);
  const prevJs = usePrevious(js);
  const previewRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReactDOMClient.Root | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const shadowRoot = useRef<ShadowRoot | null>(null);

  useEffect(() => {
    if (!previewRef.current) {
      return;
    }

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
      }

      if (!jsDiff && !cssDiff) {
        return;
      }

      if (jsDiff) {
        // Create a blob to load the JS from
        const data = new TextEncoder().encode(js);
        const blob = new Blob([data], { type: 'application/javascript' });

        const url = URL.createObjectURL(blob);

        // Import the JS from the blob
        import(/* @vite-ignore */ url).then(module => {
          if (signal.aborted) {
            return;
          }
          try {
            // Render the React component
            rootRef.current?.render(createElement(module.default));
          } catch (e) {
            console.error(e);
          }
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
  }, [css, js, prevJs, prevCss]);

  return (
    <>
      <div
        className="isolate flex h-full w-full grow transform-cpu items-center justify-center overflow-hidden"
        ref={previewRef}
      ></div>
    </>
  );
}
