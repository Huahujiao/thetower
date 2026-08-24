export default [
  {
    ignores: ['dist/**', 'src/legacy/**'],
  },
  {
    files: ['src/**/*.js', 'scripts/v2-check.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-constant-binary-expression': 'error',
      'no-redeclare': 'error',
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
]
