module.exports = {
  '*.{js,jsx,ts,tsx}': [
    'eslint --fix',
    'prettier --write',
  ],
  '*.{json,css,scss,md,html,yml,yaml}': [
    'prettier --write',
  ],
  'package*.json': [
    'npm audit --audit-level moderate',
  ],
}