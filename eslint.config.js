// NOTE: typescript-eslint does not run under TypeScript 7.0 — TS 7 dropped the
// classic compiler API that its parser is built on, so `npm run lint` currently
// fails at config load with "typescript-eslint does not support TS 7.0".
// Tracking: https://github.com/typescript-eslint/typescript-eslint/issues/10940
// This config is otherwise ready: linting works again as soon as typescript-eslint
// ships TS >=7.1 support (or if typescript is pinned back to 5.9.x).

import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', 'public'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx,mts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
)
