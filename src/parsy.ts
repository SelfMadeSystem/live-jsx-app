import { CompilerResult } from './Result';
import { Module, parse, transform } from '@swc/wasm-web';

const importPathMap = {
  react: 'https://cdn.skypack.dev/react',
  'react-dom': 'https://cdn.skypack.dev/react-dom',
};

function replaceImports(module: Module) {
  for (const node of module.body) {
    if (node.type !== 'ImportDeclaration') continue;

    const importPath = node.source.value;
    
    if (importPath in importPathMap) {
      const newImportPath =
      importPathMap[importPath as keyof typeof importPathMap];
      node.source.value = newImportPath;
      node.source.raw = `"${newImportPath}"`;
    }
  }
}

export async function transformTsx(code: string): Promise<CompilerResult> {
  const result = await parse(code, {
    syntax: 'typescript',
    tsx: true,
    decorators: true,
    dynamicImport: true,
    target: 'es2020',
  }).catch(e => {
    return { error: e };
  });

  if ('error' in result) {
    return result;
  }

  replaceImports(result);
  console.log(result);

  const transformed = await transform(result, {
    jsc: {
      target: 'es2020',
      parser: {
        syntax: 'typescript',
        tsx: true,
        decorators: true,
        dynamicImport: true,
      },
    },
  }).catch(e => {
    // typeof e === 'string' for some reason
    // eslint-disable-next-line no-control-regex
    const eWithoutAnsi = e.replace(/\u001b\[\d+m/g, '');
    return { error: eWithoutAnsi };
  });

  if ('error' in transformed) {
    return transformed;
  }

  return { code: transformed.code };
}
