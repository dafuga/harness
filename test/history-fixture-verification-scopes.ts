import type { VerificationScope } from './verification-targets';

/** Actual input/output observations of history integrity and isolated fixture attachment. */
export const historyFixtureVerificationScopes: Record<string, VerificationScope> = {
	'history-fixture-integrity': {
		package: 'root',
		vitest: {
			'test/seed-attacher.test.ts': {
				'records attached through one seed attacher leave the history the CLI leaves':
					'history-equivalence',
				'a seed attacher refuses another repository, a second attacher, a changed record and use once closed':
					'seed-isolation'
			},
			'test/history-attach-inherited.test.ts': {
				'a changed test log of an attached parent refuses its child': 'changed-parent-log',
				'a changed test log of an attached grandparent refuses its grandchild':
					'changed-grandparent-log',
				'a changed capture of an attached parent refuses its child': 'changed-parent-capture'
			},
			'test/verification-check-shared.test.ts': {
				'VerificationCheckService.integrity from default initialization': 'default',
				'a checker shared by the records of a chain answers as a fresh checker for each':
					'indexer-parity',
				'VerificationCheckService.check from default initialization': 'default',
				'VerificationCheckService.check with an injected indexer': 'indexer-parity'
			}
		},
		playwright: {}
	}
};
