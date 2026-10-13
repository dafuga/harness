import type { VerificationScope } from './verification-targets';

/**
 * Recorded evidence readers, observed through their existing integration tests. The fixtures are
 * synthetic repositories and a synthetic source: this proves the readers, not a live service.
 */
export const recordedEvidenceScopes: Record<string, VerificationScope> = {
	'desktop-recorded-evidence': {
		package: 'desktop',
		vitest: {
			'test/services/recorded-evidence.test.ts': {
				'the tip of a branch is shown alone, with what it was read at': 'current-tip',
				'a commit is compared with its exact first parent, also when it is the tip': 'first-parent',
				'a result inherited from an earlier record is not shown as one run at this commit':
					'inherited-result',
				'a commit without a record answers with its gap, and a first commit has no parent':
					'first-parent',
				'what the history does not hold together is refused, and nothing else is shown':
					'refused-scope',
				'the answer holds this entity alone and still derives itself': 'entity-projection'
			},
			'test/recorded-artifact.test.ts': {
				'a listed capture is read as its recorded bytes, with a media type that was checked':
					'artifact-binding',
				'an inherited result is read from the record that produced it, on either side':
					'inherited-result',
				'a capture of another entity, record, side or hash is refused': 'artifact-binding',
				'a capture is read only in the project that recorded it': 'project-authority',
				'a notes-only update renews the identity and keeps the shown artifact readable':
					'pinned-revisions',
				'a newer record of the same commit never stands in for the one that was shown':
					'pinned-revisions'
			},
			'test/recorded-evidence-transport.test.ts': {
				'the window reads recorded evidence and its bytes over the loopback socket': 'transport',
				'a phone reads the evidence of a granted project and of no other': 'project-authority'
			}
		},
		playwright: {}
	},
	'hub-recorded-evidence': {
		package: 'hub',
		vitest: {
			'test/services/hub-evidence.test.ts': {
				'the tip of a branch is shown alone, with what it was read at': 'current-tip',
				'a commit is compared with its exact first parent, also when it is the tip': 'first-parent',
				'a result inherited from an earlier record stays distinguishable from a run here':
					'inherited-result',
				'a commit without a record answers with its gap, and a first commit has no parent':
					'first-parent',
				'what the history does not hold together is refused with its own code': 'refused-scope',
				'someone who is not a member is refused before the cache or the source is read':
					'membership'
			},
			'test/services/hub-evidence-artifact.test.ts': {
				'the bytes of a listed capture are answered with their hash and attested type':
					'selected-bytes',
				'an inherited capture is read from the record that produced it': 'inherited-result',
				'a capture of another entity, record, side or hash is not listed and not read':
					'selected-bytes',
				'a capture is never answered for another project': 'membership',
				'an artifact of exactly 11 MiB is read, and one byte more is refused as too large':
					'size-and-type',
				'markup recorded as a screenshot is listed and never served': 'size-and-type',
				'a notes-only update gives new metadata and leaves what was shown readable':
					'pinned-revisions',
				'revisions the refs never held are refused, and earlier ones are read as they were':
					'pinned-revisions',
				'a capture of a view of the tip is refused once the tip is elsewhere': 'refused-scope'
			},
			'test/controllers/hub-evidence-controller.test.ts': {
				'evidence is answered as JSON that is not stored by a browser': 'http-boundary',
				'an artifact is answered as its bytes, with the attested type and no sniffing':
					'http-boundary',
				'nobody without a session or a membership reaches the source or the cache': 'http-boundary',
				'every field of a read is checked, and what is not a field is never used': 'http-boundary',
				'each refusal has its own code and status': 'http-boundary',
				'neither read is offered to a request that is not a GET': 'http-boundary'
			},
			'test/services/hub-reader-revocation.test.ts': {
				'membership revoked while metadata is being read denies the final answer':
					'cache-revocation',
				'membership revoked while artifact is being read denies the final answer':
					'cache-revocation',
				'a revoked principal cannot use a previously kept metadata answer': 'cache-revocation',
				'a merge commit compares only its exact first parent': 'first-parent'
			}
		},
		playwright: {}
	}
};
