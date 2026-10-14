import type { VerificationScope } from './verification-targets';

/** The fixtures that stand in for an image generator, each finishing a Plan of three options. */
export const planFixtureVerificationScopes: Record<string, VerificationScope> = {
	'plan-fixture-contracts': {
		package: 'desktop',
		vitest: {
			'test/fixture-design-options.test.ts': {
				'remote: a phone starts a Plan stating no count over the wire; it finishes with three distinct pictures':
					'remote',
				'local: a window opens its project and starts a Plan stating no count; it finishes with three distinct pictures':
					'local',
				'native: the fixture project plans with its stand-in providers, stating no count; it finishes with three distinct pictures':
					'native'
			}
		},
		playwright: {}
	}
};
