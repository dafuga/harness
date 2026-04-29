import type { PlannedFile } from '../core/files';

export function lintConfigFiles(): PlannedFile[] {
	return [
		{ path: 'eslint.frame-rules.js', contents: framePluginFile() },
		{ path: 'eslint.config.js', contents: eslintConfigFile() }
	];
}

function eslintConfigFile(): string {
	return `import eslint from '@eslint/js';\nimport tseslint from '@typescript-eslint/eslint-plugin';\nimport tsParser from '@typescript-eslint/parser';\nimport prettier from 'eslint-config-prettier';\nimport frame from './eslint.frame-rules.js';\n\nexport default [\n\t{ ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.svelte-kit/**', 'build/**'] },\n\tprettier,\n\t{\n\t\tfiles: ['src/**/*.ts', 'test/**/*.ts', 'db/**/*.ts'],\n\t\tlanguageOptions: {\n\t\t\tparser: tsParser,\n\t\t\tparserOptions: { project: './tsconfig.json' },\n\t\t\tglobals: { $state: 'readonly', Bun: 'readonly', Response: 'readonly', console: 'readonly' }\n\t\t},\n\t\tplugins: { '@typescript-eslint': tseslint, frame },\n\t\trules: {\n\t\t\t...eslint.configs.recommended.rules,\n\t\t\t'no-unused-vars': 'off',\n\t\t\t'@typescript-eslint/consistent-type-imports': 'error',\n\t\t\t'@typescript-eslint/no-explicit-any': 'error',\n\t\t\t'@typescript-eslint/no-floating-promises': 'error',\n\t\t\t'@typescript-eslint/no-misused-promises': 'error',\n\t\t\t'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],\n\t\t\t'complexity': ['error', 10],\n\t\t\t'frame/max-class-lines': 'error',\n\t\t\t'frame/max-method-lines': 'error',\n\t\t\t'frame/no-manager-name': 'error',\n\t\t\t'max-classes-per-file': ['error', 1],\n\t\t\t'max-depth': ['error', 4],\n\t\t\t'max-lines': ['error', { max: 220, skipBlankLines: true, skipComments: true }],\n\t\t\t'max-lines-per-function': ['error', { max: 55, skipBlankLines: true, skipComments: true }],\n\t\t\t'max-params': ['error', 4],\n\t\t\t'no-nested-ternary': 'error'\n\t\t}\n\t}\n];\n`;
}

function framePluginFile(): string {
	return `export default {\n\trules: {\n\t\t'max-class-lines': sizeRule('Class', 120, 'ClassDeclaration'),\n\t\t'max-method-lines': sizeRule('Method', 35, 'MethodDefinition'),\n\t\t'no-manager-name': {\n\t\t\tmeta: { type: 'suggestion', messages: { manager: 'Avoid catch-all Manager class names.' } },\n\t\t\tcreate(context) {\n\t\t\t\treturn {\n\t\t\t\t\tClassDeclaration(node) {\n\t\t\t\t\t\tif (node.id?.name?.endsWith('Manager')) context.report({ node: node.id, messageId: 'manager' });\n\t\t\t\t\t}\n\t\t\t\t};\n\t\t\t}\n\t\t}\n\t}\n};\n\nfunction sizeRule(label, max, selector) {\n\treturn {\n\t\tmeta: { type: 'suggestion', messages: { tooLarge: label + ' has {{lines}} lines. Limit is {{max}}.' } },\n\t\tcreate(context) {\n\t\t\treturn {\n\t\t\t\t[selector](node) {\n\t\t\t\t\tconst lines = node.loc.end.line - node.loc.start.line + 1;\n\t\t\t\t\tif (lines > max) context.report({ node, messageId: 'tooLarge', data: { lines, max } });\n\t\t\t\t}\n\t\t\t};\n\t\t}\n\t};\n}\n`;
}
