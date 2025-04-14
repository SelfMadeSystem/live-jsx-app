import { plugin } from 'bun';
import React, { createElement } from 'react';
import { renderToString } from 'react-dom/server';

async function prerender() {
  const myPlugin: import('bun').BunPlugin = {
    name: 'URL Loader',
    setup(build) {
      // loads `?url` as blank strings because it's not used in the server
      build.onLoad({ filter: /\?url$/ }, () => {
        return {
          contents: 'export default ""',
          loader: 'js',
        };
      });
    },
  };

  plugin(myPlugin);

  globalThis.document = globalThis.document || {
    queryCommandSupported: () => {
      // @ts-expect-error very hacky to support both monaco and sonner at the same time
      globalThis.document = undefined;
      return false;
    },
  };

  globalThis.window = globalThis.window || {
    document: globalThis.document,
    location: new URL('http://localhost'),
  };

  globalThis.React = React;

  class UIEvent {
    constructor(type: string) {
      this.type = type;
    }
    type: string;
  }

  globalThis.UIEvent = UIEvent as unknown as typeof globalThis.UIEvent;

  const { default: App } = await import('../App.tsx');

  return renderToString(createElement(App, {}));
}

console.log(await prerender());
process.exit(0);
