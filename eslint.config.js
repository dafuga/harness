import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

export default [
	{
		ignores: ['dist/**', 'node_modules/**']
	},
	eslint.configs.recommended,
	prettier,
	{
		files: ['src/**/*.ts', 'test/**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: './tsconfig.json'
			},
			globals: {
				Bun: 'readonly',
				console: 'readonly',
				Buffer: 'readonly',
				fetch: 'readonly',
				process: 'readonly',
				Response: 'readonly',
				setTimeout: 'readonly'
			}
		},
		plugins: {
			'@typescript-eslint': tseslint
		},
		rules: {
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'max-lines': ['warn', { max: 220, skipBlankLines: true, skipComments: true }],
			'max-lines-per-function': ['warn', { max: 55, skipBlankLines: true, skipComments: true }]
		}
	}
];
