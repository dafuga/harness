import type { VerificationScope } from './verification-targets';

/**
 * The hosted catalog as the hub lists it, and the copies the computer keeps of a hosted project.
 * A scenario maps the tests of one package, so each side is a scenario of its own.
 */
export const hostedVerificationScopes: Record<string, VerificationScope> = {
	'hosted-catalog': {
		package: 'hub',
		vitest: {
			'test/controllers/hub-agent.test.ts': {
				'Write dispatches only the verified actor and project through a bound executor':
					'write-access',
				'an absent or unavailable executor fails closed': 'write-access',
				'forged project context and stale revisions never reach execution': 'write-access',
				'removing membership cancels this actor\u2019s runs and denies the running authorization callback':
					'write-access',
				'viewer cannot execute and its existing runs are revoked': 'write-access',
				'commenter cannot execute and its existing runs are revoked': 'write-access'
			},

			'test/hub-catalog-listing.test.ts': {
				'the hosted catalog lists every ordinary entity and no page manifest that only loads for an address':
					'hosted-listing',
				'what the hosted catalog leaves out is still opened by its identity, with its source and history':
					'hosted-detail',
				'the same identity is listed in the tree of the commit where it renders, as it is there':
					'hosted-history',
				'a snapshot that was cached with a loader listed is not what the hosted catalog shows':
					'hosted-cache',
				'hosted entities read their committed usage document through the source cache':
					'hosted-detail'
			}
		},
		playwright: {}
	},
	'hosted-client-copies': {
		package: 'desktop',
		vitest: {
			'test/hosted-copy-listing.test.ts': {
				'a snapshot kept before the catalog left route loaders out is not shown while the hub is away':
					'earlier-copy',
				'a snapshot this build kept is shown while the hub is away, at the tip and at a pinned commit':
					'current-copy',
				'what else was kept is still shown while the hub is away': 'other-copies',
				'an earlier copy leaves with a denial like every other copy': 'denial'
			}
		},
		playwright: {}
	}
};
