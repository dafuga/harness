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
	}
};
