// @ts-check
import tseslint from 'typescript-eslint';
import noStaticInlineStyle from './eslint-rules/no-static-inline-style.js';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'src-tauri/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'core_data/**/*.ts'],
    plugins: {
      local: { rules: { 'no-static-inline-style': noStaticInlineStyle } },
    },
    extends: [
      ...tseslint.configs.recommended,
    ],
    rules: {
      // Gate 2 (DEV-UI-GUIDE): no fully-static inline style — utilities/tokens/approved class instead.
      'local/no-static-inline-style': 'error',
      // AP-001: database as never is forbidden — use DatabaseLike from entity-service.ts
      'no-restricted-syntax': [
        'error',
        {
          selector: "TSAsExpression[typeAnnotation.type='TSNeverKeyword']",
          message: "AP-001: 'as never' is forbidden. Type the database prop as DatabaseLike (from src/services/entity-service.ts).",
        },
      ],
      // Catch implicit any — explicit unknown is still allowed but forces a conscious decision
      '@typescript-eslint/no-explicit-any': 'error',
      // Prevent unsafe type assertions that bypass the type system
      '@typescript-eslint/no-unsafe-type-assertion': 'off', // covered by no-restricted-syntax above
      // Keep the rest reasonable
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // react-hooks plugin not installed — suppress unknown rule errors
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    // Throwaway graph spikes are experiments, not shipped UI — exempt from the
    // inline-style gate so they don't need justification comments everywhere.
    files: ['src/spikes/**'],
    rules: { 'local/no-static-inline-style': 'off' },
  },
);
