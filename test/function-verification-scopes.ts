import type { VerificationScope } from './verification-targets';

/** The recorded calls of real functions: each test calls the function and records what it saw. */
export const functionVerificationScopes: Record<string, VerificationScope> = {
	'function-examples': {
		package: 'desktop',
		vitest: {
			'test/compose-modes-cases.test.ts': {
				'composeModes returns comment, plan and change only where each is allowed': 'compose-modes'
			}
		},
		playwright: {}
	},
	'helper-examples': {
		package: 'root',
		vitest: {
			'test/helper-examples.test.ts': {
				'toKebabCase returns each declared example': 'function-case-to-kebab-case',
				'toPascalCase returns each declared example': 'function-case-to-pascal-case',
				'toCamelCase returns each declared example': 'function-case-to-camel-case',
				'toSnakeCase returns each declared example': 'function-case-to-snake-case'
			}
		},
		playwright: {}
	}
};
