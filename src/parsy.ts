import { CompilerResult } from './Result';
import { parse, transform } from '@swc/wasm-web';

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
