import type { PlannedFile } from '../core/files';

export function lintConfigFiles(): PlannedFile[] {
	return [
		{ path: 'eslint.harness-rules.js', contents: harnessPluginFile() },
		{ path: 'eslint.config.js', contents: eslintConfigFile() }
	];
}

function eslintConfigFile(): string {
	return `import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import harness from './eslint.harness-rules.js';

export default [
	{ ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.svelte-kit/**', 'build/**'] },
	prettier,
	{
		files: ['src/**/*.ts', 'test/**/*.ts', 'db/**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: { project: './tsconfig.json' },
			globals: { $state: 'readonly', Bun: 'readonly', Response: 'readonly', console: 'readonly' }
		},
		plugins: { '@typescript-eslint': tseslint, harness },
		rules: {
			...eslint.configs.recommended.rules,
			'no-unused-vars': 'off',
			'@typescript-eslint/consistent-type-imports': 'error',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			complexity: ['error', 10],
			'harness/max-class-lines': 'error',
			'harness/max-method-lines': 'error',
			'harness/no-manager-name': 'error',
			'max-classes-per-file': ['error', 1],
			'max-depth': ['error', 4],
			'max-lines': ['error', { max: 220, skipBlankLines: true, skipComments: true }],
			'max-lines-per-function': ['error', { max: 55, skipBlankLines: true, skipComments: true }],
			'max-params': ['error', 4],
			'no-nested-ternary': 'error'
		}
	}
];
`;
}

function harnessPluginFile(): string {
	return `export default {
	rules: {
		'max-class-lines': sizeRule('Class', 120, 'ClassDeclaration'),
		'max-method-lines': sizeRule('Method', 35, 'MethodDefinition'),
		'no-manager-name': {
			meta: { type: 'suggestion', messages: { manager: 'Avoid catch-all Manager class names.' } },
			create(context) {
				return {
					ClassDeclaration(node) {
						if (node.id?.name?.endsWith('Manager'))
							context.report({ node: node.id, messageId: 'manager' });
					}
				};
			}
		}
	}
};

function sizeRule(label, max, selector) {
	return {
		meta: {
			type: 'suggestion',
			messages: { tooLarge: label + ' has {{lines}} lines. Limit is {{max}}.' }
		},
		create(context) {
			return {
				[selector](node) {
					const lines = node.loc.end.line - node.loc.start.line + 1;
					if (lines > max) context.report({ node, messageId: 'tooLarge', data: { lines, max } });
				}
			};
		}
	};
}
`;
}
