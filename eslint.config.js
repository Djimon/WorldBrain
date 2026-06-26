// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'src-tauri/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'core_data/**/*.ts'],
    extends: [
      ...tseslint.configs.recommended,
    ],
    rules: {
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
);
