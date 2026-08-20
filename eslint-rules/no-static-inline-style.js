// @ts-check
// Gate 2 (DEV-UI-GUIDE enforcement): disallow *fully-static* inline styles.
//
// `style={{ flex: 1, minHeight: 0, maxWidth: '100%', background: '#fff' }}` is a
// hole in the token/@layer system — un-themeable, un-reusable. Layout belongs on
// utilities (u-row/u-stack/u-gap-*), colour/spacing on tokens (var(--…)), true
// residuals in an approved class.
//
// This rule fires ONLY when EVERY value in the style object is a static literal,
// i.e. nothing forces the inline form. Any dynamic value (a variable, member
// access, call, conditional, template literal with `${…}`, or a spread) makes the
// whole attribute legitimate — that's the sanctioned per-render exception
// (live positions via transform, per-record colours, …). Mixed objects pass.

/**
 * @param {import('estree').Expression | import('estree').Pattern | null | undefined} node
 * @returns {boolean}
 */
function isStaticValue(node) {
  if (!node) return false;
  switch (node.type) {
    case 'Literal':
      return true;
    case 'UnaryExpression': // e.g. -1, +2
      return isStaticValue(node.argument);
    case 'TemplateLiteral':
      return node.expressions.length === 0; // no `${…}` interpolation => static
    default:
      // Identifier, MemberExpression, CallExpression, ConditionalExpression, … => dynamic
      return false;
  }
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow fully-static inline styles; compose from utilities/tokens/approved classes (DEV-UI-GUIDE).',
    },
    schema: [],
    messages: {
      staticInlineStyle:
        'Statisches inline style={{…}} ist verboten (DEV-UI-GUIDE). Layout -> Utilities (u-row/u-stack/u-gap-*), Farbe/Abstand -> Tokens var(--…), echter Rest -> abgesegnete Klasse. Nur wirklich dynamische Werte duerfen inline bleiben.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        // @ts-expect-error JSX types come from the TS parser at runtime
        if (node.name?.name !== 'style') return;
        const val = node.value;
        if (!val || val.type !== 'JSXExpressionContainer') return;
        const expr = val.expression;
        // style={variable} or style={cond ? a : b} => dynamic, allow.
        if (!expr || expr.type !== 'ObjectExpression') return;
        if (expr.properties.length === 0) return;
        const allStatic = expr.properties.every(
          (p) => p.type === 'Property' && !p.computed && isStaticValue(p.value),
        );
        if (allStatic) context.report({ node, messageId: 'staticInlineStyle' });
      },
    };
  },
};
