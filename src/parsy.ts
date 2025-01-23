import { CompilerResult } from './Result';
import {
  JSXAttribute,
  StringLiteral,
  TemplateLiteral,
  parse,
  transform,
} from '@swc/wasm-web';

function findCssClassList(
  body:
    | (unknown | StringLiteral | TemplateLiteral | JSXAttribute | undefined)[]
    | undefined,
  classNames: Set<string> = new Set(),
  traversed = new Set(),
  frFind = false,
): Set<string> {
  if (!body) return classNames;
  for (const item of body) {
    if (!item || typeof item !== 'object') continue;
    if (traversed.has(item)) continue;
    traversed.add(item);
    if ('type' in item) {
      if (item.type === 'JSXAttribute') {
        const jsxItem = item as JSXAttribute;
        if (
          jsxItem.name.type === 'Identifier' &&
          jsxItem.name.value === 'className'
        ) {
          findCssClassList([jsxItem.value], classNames, traversed, true);
        }
      } else if (frFind) {
        if (item.type === 'StringLiteral') {
          for (const className of (item as StringLiteral).value
            .split(' ')
            .map(c => c.trim())
            .filter(Boolean)) {
            classNames.add(className);
          }
        } else if (item.type === 'TemplateLiteral') {
          for (const className of (item as TemplateLiteral).quasis
            .map(q => q.raw)
            .join(' ')
            .split(' ')
            .map(c => c.trim())
            .filter(Boolean)) {
            classNames.add(className);
          }
        }
      }
    }
    for (const key in item) {
      const value = item[key as keyof typeof item];
      if (Array.isArray(value)) {
        findCssClassList(value, classNames, traversed, frFind);
      } else if (value && typeof value === 'object') {
        findCssClassList([value], classNames, traversed, frFind);
      }
    }
  }

  return classNames;
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

  const classList = findCssClassList(result.body);

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

  return { code: transformed.code, classList };
}
