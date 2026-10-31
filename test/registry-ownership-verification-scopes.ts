import type { VerificationScope } from './verification-targets';

/** The unchanged unit-index suite is the ownership qualification boundary. */
export const registryOwnershipVerificationScopes: Record<string, VerificationScope> = {
	'unit-registry-ownership': {
		package: 'root',
		vitest: {
			'test/services/unit-index.test.ts': {
				'atomic levels follow runtime calls and survive projections': 'registry-ownership',
				'HTTP requests bind to endpoints in the owning app and selected source tree':
					'registry-ownership',
				'source indexing derives contracts across callable, component and storage states':
					'registry-ownership',
				'source indexing bounds pending reads and keeps every file in source order':
					'registry-ownership',
				'source indexing reports failed reads even after its read window fills':
					'registry-ownership',
				'source indexing releases parsed blobs from prior revisions': 'registry-ownership',
				'identical blobs keep path-specific references and ignored files stay unread':
					'registry-ownership',
				'source indexing preserves admitted entry getters, species, and method receivers':
					'registry-ownership',
				'recorded source moves retain definitions, owner-local placement and registered identity':
					'registry-ownership',
				'public route filenames retain their registered ownership': 'registry-ownership',
				'declared preview and documentation survive source re-indexing': 'registry-ownership',
				'declared execution targets survive re-indexing and follow a moved default entry':
					'registry-ownership',
				'recreating retired source elsewhere records lineage to the retired identity':
					'registry-ownership',
				'a unit that takes a retired name records lineage even when its symbols differ':
					'registry-ownership',
				'lineage cannot be dropped by editing the manifest': 'registry-ownership',
				'unrelated new units carry no lineage': 'registry-ownership',
				'a declared responsibility survives re-indexing while a derived one follows the unit':
					'registry-ownership',
				'an alternative implementation is a related unit linked by a declared contract dependency':
					'registry-ownership',
				'several owned files produce identical metadata after one indexing pass':
					'registry-ownership',
				'recorded service moves preserve implementations and registered owner-local placement':
					'registry-ownership'
			}
		},
		playwright: {}
	}
};
