// NOTE: TypeScript 7.0 ships no compiler API at all, so typescript-eslint - whose
// parser imports it - cannot run against it. The fix is Microsoft's own: the 6.0
// API is installed side by side under the `typescript` name, while TS 7 keeps the
// `tsc` this project builds with. See the aliases in package.json.
// Nothing here reads types, so 6.0 is only ever used to parse.
// Revisit when typescript-eslint ports to the API TypeScript 7.1 will ship:
// https://github.com/typescript-eslint/typescript-eslint/issues/10940

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
