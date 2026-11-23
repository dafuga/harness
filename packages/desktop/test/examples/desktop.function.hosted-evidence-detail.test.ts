import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hostedEvidenceDetail } from '../../src/utils/verification-evidence/hostedEvidenceDetail';

const commit = 'a'.repeat(40);
const emptyChanges = { direct: [], indirect: [], added: [], removed: [] };
const detail = {
	commit,
	registry: {
		available: true,
		units: [],
		scenarios: [],
		graph: { edges: [] }
	},
	comparison: {
		base: null,
		record: 'baseline',
		units: emptyChanges,
		scenarios: [],
		uncertain: []
	},
	records: [],
	explanations: []
};

test('accepts complete details and rejects undeclared fields', () => {
	const accepted = hostedEvidenceDetail.safeParse(detail);
	const rejected = hostedEvidenceDetail.safeParse({ ...detail, unexpected: true });

	expect(accepted.success).toBe(true);
	expect(rejected.success).toBe(false);

	if (!accepted.success || rejected.success)
		throw new Error('Expected one valid and one rejected detail.');

	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-evidence-detail',
			symbol: 'hostedEvidenceDetail',
			state: 'accepts-complete-details-and-rejects-undeclared-fields',
			evidence: 'examples-cases',
			file: 'accepts-complete-details-and-rejects-undeclared-fields.json'
		},
		[
			{
				name: 'valid empty registry detail',
				input: detail,
				output: { success: accepted.success, commit: accepted.data.commit }
			},
			{
				name: 'reject an undeclared top-level field',
				input: { ...detail, unexpected: true },
				error: { name: 'ZodError', message: rejected.error.message }
			}
		]
	);
});
