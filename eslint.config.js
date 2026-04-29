import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import frame from './eslint.frame-rules.js';

const frameLimits = {
	maxFileLines: 220,
	maxFunctionLines: 55,
	maxNestingDepth: 4,
	maxParameters: 4,
	maxComplexity: 10,
	maxClassesPerFile: 1
};

export default [
	{
		ignores: ['dist/**', 'node_modules/**']
	},
	{
		files: ['*.js'],
		languageOptions: {
			globals: {
				URL: 'readonly'
			}
		}
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
				setTimeout: 'readonly',
				URL: 'readonly'
			}
		},
		plugins: {
			'@typescript-eslint': tseslint,
			frame
		},
		rules: {
			...eslint.configs.recommended.rules,
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/await-thenable': 'error',
			'@typescript-eslint/consistent-type-imports': 'error',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/no-unnecessary-type-assertion': 'error',
			'@typescript-eslint/prefer-nullish-coalescing': 'error',
			'@typescript-eslint/prefer-optional-chain': 'error',
			'complexity': ['error', frameLimits.maxComplexity],
			'consistent-return': 'error',
			'frame/architecture-boundaries': 'error',
			'frame/max-class-lines': 'error',
			'frame/max-method-lines': 'error',
			'frame/no-manager-name': 'error',
			'frame/thin-command-modules': 'error',
			'max-classes-per-file': ['error', frameLimits.maxClassesPerFile],
			'max-depth': ['error', frameLimits.maxNestingDepth],
			'max-lines': ['error', { max: frameLimits.maxFileLines, skipBlankLines: true, skipComments: true }],
			'max-lines-per-function': [
				'error',
				{ max: frameLimits.maxFunctionLines, skipBlankLines: true, skipComments: true }
			],
			'max-params': ['error', frameLimits.maxParameters],
			'no-lonely-if': 'error',
			'no-nested-ternary': 'error',
			'no-unused-expressions': 'error'
		}
	}
];
