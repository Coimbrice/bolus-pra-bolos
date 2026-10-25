import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', '_site'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['examples/**'],
    languageOptions: { globals: { console: 'readonly' } },
  },
  {
    files: ['site/**'],
    languageOptions: { globals: { document: 'readonly' } },
  },
);
