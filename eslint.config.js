import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import harness, { harnessRuleLimits } from './eslint.harness-rules.js';

export default [
	{
		ignores: ['dist/**', 'node_modules/**', '.cache/**']
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
			harness
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
			complexity: ['error', harnessRuleLimits.maxComplexity],
			'consistent-return': 'error',
			'harness/architecture-boundaries': 'error',
			'harness/max-class-lines': 'error',
			'harness/max-method-lines': 'error',
			'harness/no-manager-name': 'error',
			'harness/thin-command-modules': 'error',
			'max-classes-per-file': ['error', harnessRuleLimits.maxClassesPerFile],
			'max-depth': ['error', harnessRuleLimits.maxNestingDepth],
			'max-lines': [
				'error',
				{ max: harnessRuleLimits.maxFileLines, skipBlankLines: true, skipComments: true }
			],
			'max-lines-per-function': [
				'error',
				{ max: harnessRuleLimits.maxFunctionLines, skipBlankLines: true, skipComments: true }
			],
			'max-params': ['error', harnessRuleLimits.maxParameters],
			'no-lonely-if': 'error',
			'no-nested-ternary': 'error',
			'no-unused-expressions': 'error'
		}
	}
];
