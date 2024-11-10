import eslint from '@eslint/js';
import sort from 'esortslint-plugin-simple-import-';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'simple-import-sort': sort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
    },
    ignores: ['./dist', './node_modules'],
    overrides: [
      {
        files: ['./src/tests/**/*'],
        env: {
          jest: true,
        },
      },
    ],
  }
);
