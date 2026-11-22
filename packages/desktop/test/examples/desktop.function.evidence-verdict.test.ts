import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { evidenceVerdict } from '../../src/components/explorer-ui/entity-view/evidenceVerdict';
import type { Judged } from '../../src/components/explorer-ui/entity-view/evidenceVerdict.types';
import type { EvidenceRead } from '../../src/utils/explorer-ui/evidenceVerdict';
import type { EntityEvidenceResult } from '../../src/models/verification-evidence/DesktopEvidence.types';
import { readingEvidence } from '../../src/utils/verification-evidence/evidenceNotice';

const commit = 'a41d7e9c02b6f35e8d1a4c7b90e2f6d3c5a8b174';
const otherCommit = '7c2e0f48d91b6a35e0c4f7d2b8a91e6c3f05d4b2';

const entity: Judged = {
	id: 'desktop.function.evidence-verdict',
	kind: 'function',
	verification: 'unknown',
	verificationNote: 'No complete verification for this entity at this commit has been loaded.'
};

function read(status: EvidenceRead['status'], error = ''): EvidenceRead {
	return { status, result: null, error };
}

function readWithAfter(after: unknown): EvidenceRead {
	const result = { evidence: { after } } as unknown as EntityEvidenceResult;
	return { status: 'ready', result, error: '' };
}

test('Repeats the catalog verdict for idle and planned reads', () => {
	const idle = evidenceVerdict(read('idle'), entity, commit);
	const planned = evidenceVerdict(read('planned'), entity, commit);

	expect(idle).toEqual({ status: entity.verification, reason: entity.verificationNote });
	expect(planned).toEqual(idle);

	recordExampleCases(
		{
			unitId: 'desktop.function.evidence-verdict',
			symbol: 'evidenceVerdict',
			state: 'repeats-the-catalog-verdict-for-idle-and-planned-reads',
			evidence: 'examples-cases',
			file: 'repeats-the-catalog-verdict-for-idle-and-planned-reads.json'
		},
		[
			{ name: 'idle read repeats the catalog status and note', input: { status: 'idle', commit }, output: idle },
			{ name: 'planned read repeats the catalog status and note', input: { status: 'planned', commit }, output: planned }
		]
	);
});

test('Reports unavailable and failed reads as unknown', () => {
	const unavailable = evidenceVerdict(read('unavailable'), entity, commit);
	const failed = evidenceVerdict(read('failed', 'evidence store responded with status 503'), entity, commit);

	expect(unavailable.status).toBe('unknown');
	expect(unavailable.reason.length).toBeGreaterThan(0);
	expect(failed.status).toBe('unknown');
	expect(failed.reason.length).toBeGreaterThan(0);

	recordExampleCases(
		{
			unitId: 'desktop.function.evidence-verdict',
			symbol: 'evidenceVerdict',
			state: 'reports-unavailable-and-failed-reads-as-unknown',
			evidence: 'examples-cases',
			file: 'reports-unavailable-and-failed-reads-as-unknown.json'
		},
		[
			{ name: 'unavailable read gives unknown with a reason', input: { status: 'unavailable', commit }, output: unavailable },
			{
				name: 'failed read gives unknown with a reason',
				input: { status: 'failed', error: 'evidence store responded with status 503', commit },
				output: failed
			}
		]
	);
});

test('Refuses to judge evidence read for another commit', () => {
	const verdict = evidenceVerdict(readWithAfter({ commit: otherCommit }), entity, commit);

	expect(verdict).toEqual({ status: 'unknown', reason: readingEvidence });

	recordExampleCases(
		{
			unitId: 'desktop.function.evidence-verdict',
			symbol: 'evidenceVerdict',
			state: 'refuses-to-judge-evidence-read-for-another-commit',
			evidence: 'examples-cases',
			file: 'refuses-to-judge-evidence-read-for-another-commit.json'
		},
		[
			{
				name: 'ready evidence names another commit',
				input: { status: 'ready', afterCommit: otherCommit, commit },
				output: verdict
			}
		]
	);
});

test('Gives unknown when the side does not hold the entity', () => {
	const gapped = { commit, detail: null, gap: 'The evidence that was read does not include this entity.' };
	const bare = { commit, detail: null };
	const withGap = evidenceVerdict(readWithAfter(gapped), entity, commit);
	const withoutGap = evidenceVerdict(readWithAfter(bare), entity, commit);

	expect(withGap).toEqual({ status: 'unknown', reason: gapped.gap });
	expect(withoutGap.status).toBe('unknown');
	expect(withoutGap.reason).toContain('does not hold this entity');

	recordExampleCases(
		{
			unitId: 'desktop.function.evidence-verdict',
			symbol: 'evidenceVerdict',
			state: 'gives-unknown-when-the-side-does-not-hold-the-entity',
			evidence: 'examples-cases',
			file: 'gives-unknown-when-the-side-does-not-hold-the-entity.json'
		},
		[
			{ name: 'side with no detail repeats its gap', input: { after: gapped, commit }, output: withGap },
			{ name: 'side with no detail and no gap explains the miss', input: { after: bare, commit }, output: withoutGap }
		]
	);
});
