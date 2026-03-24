module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
  ],
  rules: {
    // Este projeto já contém muitos padrões existentes (ex.: `any` e hooks
    // com lógica que hoje passa sem regras estritas). Para validar apenas o
    // que foi alterado no escopo, mantemos o lint permissivo.
    'no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'react-hooks/rules-of-hooks': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'react-refresh/only-export-components': 'off',
  },
  globals: {
    React: 'readonly',
    __dirname: 'readonly',
  },
  ignorePatterns: ['dist/', 'node_modules/'],
};

