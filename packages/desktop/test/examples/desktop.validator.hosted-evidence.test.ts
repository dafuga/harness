import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { HostedEvidenceValidator } from '../../src/validators/verification-evidence/HostedEvidenceValidator';
import { HostedEvidenceValidationError } from '../../src/validators/verification-evidence/HostedEvidenceValidator.types';

const commit = '0123456789abcdef0123456789abcdef01234567';
const parent = '89abcdef0123456789abcdef0123456789abcdef';
const query = {
	projectId: 'example-project',
	entityId: 'reports.component.evidence-grid',
	commit,
	branch: 'main',
	mode: 'current' as const
};

function answer() {
	return {
		identity: {
			principalId: 'google-user-12345', projectId: 'example-project', repositoryId: 42,
			requestedRef: 'main', sourceCommit: commit,
			sourceTree: 'abcdef0123456789abcdef0123456789abcdef01',
			notesRef: 'refs/notes/harness', notesRevision: null,
			evidenceRef: 'refs/heads/harness-evidence', evidenceRevision: null,
			historyIndexRevision: null, artifactHash: null, profile: null
		},
		scope: {
			location: { branch: 'main', commit, category: 'components', entity: query.entityId },
			mode: 'current', branch: 'main', tip: commit, commit, atTip: true, parent,
			summary: {
				commit, parents: [parent], subject: 'Add hosted evidence summaries',
				author: 'Example Developer', committedAt: '2026-11-15T12:00:00Z',
				branches: ['main'], retained: true, coverage: 'unverified',
				gaps: ['No verification record is available.'], records: [], legacy: []
			}
		},
		evidence: {
			mode: 'current', scenarios: [],
			after: { commit, detail: null, record: null, gap: 'No hosted evidence record is available.', coverage: [], captures: [] },
			before: null, initial: null, incomparable: []
		},
		behavior: { mode: 'current', rows: [], summary: 'not-compared', reason: null, scenarios: [] }
	};
}

test('accepts a current answer bound to the requested branch tip', () => {
	const validator = new HostedEvidenceValidator();
	const valid = answer();
	const output = validator.evidence(valid, query);
	let thrown: unknown;
	try {
		validator.evidence({ ...valid, identity: { ...valid.identity, projectId: 'other-project' } }, query);
	} catch (error) {
		thrown = error;
	}

	expect(output).toBe(valid);
	expect(thrown).toBeInstanceOf(HostedEvidenceValidationError);
	if (!(thrown instanceof Error)) throw new Error('Expected a hosted evidence validation error.');
	recordExampleCases(
		{
			unitId: 'desktop.validator.hosted-evidence', symbol: 'HostedEvidenceValidator.evidence',
			state: 'accepts-a-current-answer-bound-to-the-requested-branch-tip',
			evidence: 'examples-cases', file: 'accepts-a-current-answer-bound-to-the-requested-branch-tip.json'
		},
		[
			{ name: 'accept matching current branch-tip evidence', input: { value: valid, query }, output: { commit: output.scope.commit, entity: output.scope.location.entity, mode: output.evidence.mode } },
			{ name: 'reject evidence for another project', input: { value: { ...valid, identity: { ...valid.identity, projectId: 'other-project' } }, query }, error: { name: thrown.name, message: thrown.message } }
		]
	);
});
