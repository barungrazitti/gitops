module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    // More lenient rules for development
    indent: ['warn', 2], // Change to warning
    'linebreak-style': 'off', // Disable line ending checks
    quotes: ['warn', 'single'], // Change to warning
    semi: ['warn', 'always'], // Change to warning
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // Change to warning
    'no-console': 'off',
    'no-trailing-spaces': 'off', // Disable trailing spaces check
    'eol-last': 'off', // Disable final newline check
    'comma-dangle': 'off', // Allow trailing commas
    'object-curly-spacing': 'off', // Flexible object spacing
    'array-bracket-spacing': 'off', // Flexible array spacing
    'space-before-function-paren': 'off', // Flexible function spacing
    'keyword-spacing': 'off', // Flexible keyword spacing
    'space-infix-ops': 'off', // Flexible operator spacing
    'no-multiple-empty-lines': 'off', // Allow multiple empty lines
    'padded-blocks': 'off', // Allow padded blocks
  },
};
