import type { VerificationScope } from './verification-targets';

/** Tests read the same shared case table; browser outputs are actual observations of the shell. */
export const sharedCaseVerificationScopes: Record<string, VerificationScope> = {
	'shared-test-cases': {
		package: 'desktop',
		vitest: {
			'test/shared-test-cases.test.ts': {
				'a component or service test shares the recorded input and output table': 'case-unit-tests',
				'test rows remain unavailable when their artifact was not read and verified':
					'case-unit-tests'
			}
		},
		playwright: {
			'tests/e2e/ui-test-cases.spec.ts': [
				'component-current',
				'service-current',
				'page-current',
				'config-current',
				'component-commit'
			]
		}
	}
};
