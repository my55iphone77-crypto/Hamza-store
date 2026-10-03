import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: [
      '**/*.cjs',
      'src/app/server.js',
      'src/app/auth.js',
      'src/app/db.js',
      'src/app/mail.js',
      'src/controllers/**/*.js',
      'src/routes/**/*.js',
      'tailwind.config.js',
    ],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
    },
  },
])
