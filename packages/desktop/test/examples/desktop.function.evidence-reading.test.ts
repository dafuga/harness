import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { evidenceReading } from '../../src/utils/verification-evidence/evidenceReading';
import type { EvidenceRead } from '../../src/utils/verification-evidence/evidenceReading.types';

type Bridge = Parameters<typeof evidenceReading>[0];
type Result = Parameters<typeof evidenceReading>[1];
type Scope = Parameters<typeof evidenceReading>[2];

const commit = '64c5c4f3a1b2d3e4f5a6b7c8d9e0f123456789ab';
const entityId = 'desktop.function.evidence-reading';

function evidenceAnswer(): Result {
	const result: Result = {
		scope: {
			location: { branch: 'main', commit: null, category: 'functions', entity: entityId },
			mode: 'current',
			branch: 'main',
			tip: commit,
			commit,
			atTip: true,
			parent: null,
			summary: {
				commit,
				parents: [],
				subject: 'Read and compare recorded results',
				author: 'Harness',
				committedAt: '2026-11-15T12:00:00.000Z',
				branches: ['main'],
				retained: true,
				coverage: 'unverified',
				gaps: [],
				records: [],
				legacy: []
			}
		},
		identity: {
			principalId: 'local-filesystem:current',
			projectId: 'local-8e8dd498b7b5bf0b1e87776dac232646c9f59a4cc97370edaecc8cab7bd4b98d',
			repositoryId: 0,
			requestedRef: 'main',
			sourceCommit: commit,
			sourceTree: '89abcdef0123456789abcdef0123456789abcdef',
			notesRef: 'refs/notes/harness',
			notesRevision: null,
			evidenceRef: 'refs/heads/harness-evidence',
			evidenceRevision: null,
			historyIndexRevision: 'a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4',
			artifactHash: null,
			profile: null
		},
		evidence: {
			mode: 'current',
			scenarios: [],
			after: { commit, detail: null, record: null, captures: [], coverage: [], gap: null },
			before: null,
			initial: null,
			incomparable: []
		},
		behavior: { mode: 'current', rows: [], summary: 'not-compared', reason: null, scenarios: [] }
	};
	return result;
}

function scopeQuery(): Scope {
	return { projectId: evidenceAnswer().identity.projectId, entityId, commit, branch: 'main', mode: 'current' };
}

test('Reads a result with no stored captures', async () => {
	const result = evidenceAnswer();
	const scope = scopeQuery();
	const read: EvidenceRead = await evidenceReading({}, result, scope);

	expect(read.refusals).toEqual({});
	expect(read.behavior).toMatchObject({ mode: 'current', summary: 'not-compared', rows: [] });

	recordExampleCases(
		{
			unitId: 'desktop.function.evidence-reading',
			symbol: 'evidenceReading',
			state: 'reads-a-result-with-no-stored-captures',
			evidence: 'examples-cases',
			file: 'reads-a-result-with-no-stored-captures.json'
		},
		[
			{
				name: 'result without captures and without an artifact reader',
				input: {
					bridgeHasArtifactReader: false,
					capturesOnAfterSide: 0,
					scope: { entityId, branch: 'main', mode: 'current' }
				},
				output: read
			}
		]
	);
});

test('Does not call the artifact reader without a stored capture', async () => {
	let calls = 0;
	const bridge: Bridge = {
		artifact: async () => {
			calls += 1;
			throw new Error('The artifact reader must not run without a capture.');
		}
	};
	const read: EvidenceRead = await evidenceReading(bridge, evidenceAnswer(), scopeQuery());

	expect(calls).toBe(0);
	expect(read.refusals).toEqual({});

	recordExampleCases(
		{
			unitId: 'desktop.function.evidence-reading',
			symbol: 'evidenceReading',
			state: 'does-not-call-the-artifact-reader-without-a-stored-capture',
			evidence: 'examples-cases',
			file: 'does-not-call-the-artifact-reader-without-a-stored-capture.json'
		},
		[
			{
				name: 'artifact reader present but no capture listed on either side',
				input: { bridgeHasArtifactReader: true, capturesOnAfterSide: 0 },
				output: { artifactCalls: calls, refusals: read.refusals }
			}
		]
	);
});
