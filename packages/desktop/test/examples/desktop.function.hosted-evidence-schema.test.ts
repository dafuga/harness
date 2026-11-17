import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hostedEvidenceSchema } from '../../src/utils/verification-evidence/hostedEvidenceSchema';

const sha = 'a'.repeat(40);
const side = { commit: sha, detail: null, record: null, gap: null, coverage: [], captures: [] };

function answer() {
	return {
		identity: {
			principalId: 'example-user', projectId: 'demo-project', repositoryId: 17,
			requestedRef: 'main', sourceCommit: sha, sourceTree: sha,
			notesRef: 'refs/notes/harness', notesRevision: null,
			evidenceRef: 'refs/heads/harness-evidence', evidenceRevision: null,
			historyIndexRevision: null, collaborationRevision: null, artifactHash: null, profile: 'ci'
		},
		scope: {
			location: { branch: 'main', commit: null, category: 'desktop', entity: 'desktop.function.demo' },
			mode: 'current', branch: 'main', tip: sha, commit: sha, atTip: true, parent: null,
			summary: {
				commit: sha, parents: [], subject: 'Add demo', author: 'Example Author', committedAt: '2026-11-17T12:00:00Z',
				branches: ['main'], retained: true, coverage: 'verified', gaps: [], records: [], legacy: [],
				changes: { base: null, direct: [], added: [], removed: [] }
			}
		},
		evidence: { mode: 'current', scenarios: [], after: side, before: null, initial: null, incomparable: [] },
		behavior: { mode: 'current', rows: [], summary: 'not-compared', reason: null, scenarios: [] }
	};
}

test('accepts complete evidence and rejects extra fields', () => {
	const valid = answer();
	const accepted = hostedEvidenceSchema.safeParse(valid);
	const invalid = { ...answer(), extra: true };
	const rejected = hostedEvidenceSchema.safeParse(invalid);

	expect(accepted.success).toBe(true);
	expect(rejected.success).toBe(false);
	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-evidence-schema', symbol: 'hostedEvidenceSchema',
			state: 'accepts-complete-evidence-and-rejects-extra-fields',
			evidence: 'examples-cases', file: 'accepts-complete-evidence-and-rejects-extra-fields.json'
		},
		[
			{ name: 'complete current evidence answer', input: valid, output: { success: accepted.success } },
			{ name: 'answer with an undeclared root field', input: invalid, output: { success: rejected.success, issue: rejected.success ? null : rejected.error.issues[0]?.code } }
		]
	);
});
