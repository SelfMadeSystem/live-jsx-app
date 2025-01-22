import { CompilerResult } from './Result';
import {
  AssignmentPatternProperty,
  ImportSpecifier,
  Module,
  ModuleItem,
  ObjectPattern,
  StringLiteral,
  VariableDeclaration,
  VariableDeclarator,
  parse,
  transform,
} from '@swc/wasm-web';

/*
I want to convert:

  import { useState } from 'react';
  import React from 'react';
  import React, { useState } from 'react';
  import * as React from 'react';

Into:

  const { useState } = React;
  // <nothing> (React is already defined globally)
  const { useState } = React;
  // <also nothing>

 */

function importSpecifierToVariableDeclarator(
  specifiers: ImportSpecifier[],
  source: StringLiteral,
): VariableDeclarator & {
  id: {
    type: 'ObjectPattern';
  };
} {
  const properties: AssignmentPatternProperty[] = [];

  for (const specifier of specifiers) {
    // Ignore default imports and namespace imports
    if (specifier.type === 'ImportSpecifier') {
      properties.push({
        type: 'AssignmentPatternProperty',
        span: specifier.span,
        key: specifier.local,
      });
    }
  }

  return {
    type: 'VariableDeclarator',
    span: specifiers[0].span,
    definite: false,
    id: {
      type: 'ObjectPattern',
      span: specifiers[0].span,
      // @ts-expect-error I think the types are wrong
      ctxt: 1,
      properties,
      optional: false,
    } satisfies ObjectPattern,
    init: {
      type: 'Identifier',
      span: source.span,
      // @ts-expect-error I think the types are wrong
      ctxt: 1,
      value: 'React',
      optional: false,
    },
  };
}

function replaceImports(module: Module): Module {
  const newBody: ModuleItem[] = [];
  for (let i = 0; i < module.body.length; i++) {
    const node = module.body[i];
    if (node.type !== 'ImportDeclaration') {
      newBody.push(node);
      continue;
    }

    const importPath = node.source.value;
    if (importPath === 'react') {
      const declarators = importSpecifierToVariableDeclarator(
        node.specifiers,
        node.source,
      );

      if (declarators.id.properties.length > 0) {
        newBody.push({
          type: 'VariableDeclaration',
          kind: 'const',
          span: node.span,
          // @ts-expect-error I think the types are wrong
          ctxt: 0,
          declare: false,
          declarations: [declarators],
        } satisfies VariableDeclaration);
      }
    }
  }

  return {
    ...module,
    body: newBody,
  };
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

  const replacedResult = replaceImports(result);

  const transformed = await transform(replacedResult, {
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
