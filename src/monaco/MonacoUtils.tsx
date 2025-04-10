import * as m from 'monaco-editor';

function checkForTypeScript(response: Response) {
  const contentType = response.headers.get('Content-Type');
  if (!contentType) {
    return false;
  }
  return (
    contentType.includes('application/typescript') ||
    contentType.includes('text/typescript')
  );
}

async function fetchTypeScriptFromHeader(
  url: URL,
  response: Response,
): Promise<false | string> {
  const typescriptHeader = response.headers.get('X-Typescript-Types');
  if (!typescriptHeader) {
    return false;
  }
  const typescriptHeaderURL = new URL(typescriptHeader, url);
  return fetchTypings(typescriptHeaderURL);
}

async function fetchTypings(url: URL): Promise<string | false> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch typings from ${url}. Status: ${response.status}`,
    );
  }

  if (checkForTypeScript(response)) {
    const text = await response.text();
    return text;
  }

  const ts = await fetchTypeScriptFromHeader(url, response);
  if (ts) {
    return ts;
  }

  return false;
}

export function getImportUrl(library: string) {
  const CDN_URL = 'https://esm.sh/';

  const url = new URL(library, CDN_URL);
  url.searchParams.set('dts', 'true');
  // don't let esm.sh bundle react and react-dom
  url.searchParams.set('external', 'react,react-dom');

  return url;
}

export async function tryToAddTypingsToMonaco(
  monaco: typeof m,
  library: string,
  setImportMap: React.Dispatch<React.SetStateAction<Record<string, string>>>,
) {
  const url = getImportUrl(library);
  const typings = await fetchTypings(url).catch<false>(e => {
    console.error('Failed to fetch typings:', e);
    return false;
  });
  if (!typings) {
    return;
  }

  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    typings,
    `types/${library}/index.d.ts`,
  );

  setImportMap(prev => ({
    ...prev,
    [library]: url.toString(),
  }));
}

export function getExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) {
    return '';
  }
  return '.' + parts[parts.length - 1];
}

export function getLanguageForExtension(extension: string): string {
  const language = m.languages
    .getLanguages()
    .find(lang => lang.extensions?.includes(extension));
  if (language) {
    return language.id;
  }

  return 'plaintext';
}
