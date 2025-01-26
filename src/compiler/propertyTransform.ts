import type { TransformedProperty } from './compilerResult';
import postcss from 'postcss';
import safe from 'postcss-safe-parser';

/**
 * Finds all registered CSS properties in a PostCSS root.
 *
 * Registered CSS properties are defined using the `@property` rule.
 */
function findCssProperties(root: postcss.Root): PropertyDefinition[] {
  const properties: PropertyDefinition[] = [];
  root.walkAtRules('property', rule => {
    const property = {
      name: rule.params,
      syntax: '',
      inherits: false,
      initialValue: '',
    };
    rule.walkDecls(decl => {
      switch (decl.prop) {
        case 'syntax':
          // syntax should always be in quotes. If it is, remove the quotes
          property.syntax = decl.value.replace(/['"]+/g, '');
          break;
        case 'inherits':
          property.inherits = decl.value === 'true';
          break;
        case 'initial-value':
          property.initialValue = decl.value;
          break;
      }
    });
    properties.push(property);
  });
  return properties;
}

/**
 * Removes all registered CSS properties from a PostCSS root.
 *
 * @returns The resulting CSS string.
 */
function removeCssProperties(root: postcss.Root) {
  root.walkAtRules('property', rule => {
    rule.remove();
  });
}

/**
 * Creates a regex pattern that matches a CSS property name.
 */
function createPropertyPattern(name: string) {
  return new RegExp(`(?<=[^a-zA-Z0-9]|^)${name}(?=[^a-zA-Z0-9]|$)`, 'g');
}

/**
 * Replaces all instances of a CSS properties with other properties in a PostCSS
 * root.
 */
function replaceCssProperty(
  root: postcss.Root,
  replacements: [string, string][],
) {
  root.walkDecls(decl => {
    replacements.forEach(([oldProperty, newProperty]) => {
      const pattern = createPropertyPattern(oldProperty);
      decl.prop = decl.prop.replace(pattern, newProperty);
      decl.value = decl.value.replace(pattern, newProperty);
    });
  });
}

/**
 * Replaces all instances of a CSS property in an HTML string with another
 * property name.
 */
function replaceHtmlProperty(
  html: string,
  oldProperty: string,
  newProperty: string,
) {
  return html.replace(createPropertyPattern(oldProperty), newProperty);
}

/**
 * Sanatizes a string so it can be used as a CSS property name.
 */
function sanitizePropertyName(name: string) {
  return name.replace(/[^a-zA-Z0-9-]/g, '_');
}

export type PropertyCompilerResult = {
  css: string;
  js: string;
  properties: TransformedProperty[];
};

export type TransformCssPropertiesOptions = {
  dontRegister: boolean;
  replaceRoot: boolean;
};

export function transformCssProperties(
  css: string,
  js: string,
  ogOpts: Partial<TransformCssPropertiesOptions> = {},
): PropertyCompilerResult {
  const options = {
    dontRegister: false,
    replaceRoot: true,
    ...ogOpts,
  };
  const postcssRoot = postcss().process(css, {
    parser: safe,
  }).root;
  const cssProperties = findCssProperties(postcssRoot);
  const ids = cssProperties.map(({ name, inherits, initialValue, syntax }) => {
    // Don't need to make a random ID for the property name since, even if
    // there are duplicate property names, if they have different syntax
    // or initial values, they are considered different properties.
    // Furthermore, it doesn't matter if the property is shared between
    // different components since the property name is scoped to the
    // component.
    // Don't need the -- prefix for the property name
    const smolName = name.slice(2);
    return sanitizePropertyName(
      `--${smolName}-${initialValue}-${syntax}-${inherits}`,
    );
  });

  const replacedCssProperties = cssProperties.map((property, i) => ({
    ...property,
    name: ids[i],
    original: property.name,
  }));

  if (!options.dontRegister) {
    // Register all CSS properties
    replacedCssProperties.forEach(p => {
      try {
        CSS.registerProperty(p);
      } catch (e) {
        // Ignore `InvalidModificationError: Failed to execute 'registerProperty' on 'CSS': The name provided has already been registered`
        // We ignore this error because it is not an issue if the property is already registered
        if (
          typeof e !== 'object' ||
          !e ||
          !('name' in e) ||
          e.name !== 'InvalidModificationError'
        ) {
          console.error(e);
        }
      }
    });
  }

  // Replace all CSS properties in the HTML string with the generated
  // property names
  let replacedJs = js;
  cssProperties.forEach((property, i) => {
    replacedJs = replaceHtmlProperty(replacedJs, property.name, ids[i]);
  });

  // Replace all CSS properties in the CSS string with the generated
  // property names
  removeCssProperties(postcssRoot);
  replaceCssProperty(
    postcssRoot,
    cssProperties.map((p, i) => [p.name, ids[i]]),
  );
  let replacedCss = postcssRoot.toString();

  if (options.replaceRoot) {
    // :root doesn't work in shadow DOM, so we need to replace it with the
    // :host selector
    replacedCss = replacedCss.replace(/:root/g, ':host');
  }

  return {
    css: replacedCss,
    js: replacedJs,
    properties: replacedCssProperties,
  };
}
