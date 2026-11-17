import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type {
	EntityEvidenceQuery,
	EntityEvidenceResult,
	EvidenceArtifactQuery,
	EvidenceArtifactResult
} from '../../src/models/verification-evidence/DesktopEvidence.types';

const query: EntityEvidenceQuery = {
	projectId: 'example-project',
	entityId: 'desktop.component.example',
	commit: 'a'.repeat(40),
	branch: 'main',
	mode: 'current'
};
const result = {
	scope: {},
	identity: {
		principalId: 'example-user', projectId: 'example-project', repositoryId: 42,
		requestedRef: 'main', sourceCommit: 'a'.repeat(40), sourceTree: 'b'.repeat(40),
		notesRef: null, notesRevision: null, evidenceRef: null, evidenceRevision: null,
		historyIndexRevision: null, artifactHash: null, profile: null
	},
	evidence: {}, behavior: {}
} as unknown as EntityEvidenceResult;
const artifactQuery: EvidenceArtifactQuery = {
	...query, mode: 'commit', side: 'after', recordId: 'record-1',
	scenarioId: 'scenario-1', state: 'desktop', evidenceId: 'capture-1',
	viewport: 'desktop', sha256: 'c'.repeat(64), notesRevision: null, evidenceRevision: null
};
const artifactResult: EvidenceArtifactResult = {
	bytes: new Uint8Array([1, 2, 3]), mediaType: 'image/png', sha256: artifactQuery.sha256
};

test('represents desktop evidence query and capture shapes', () => {
	expect(query.mode).toBe('current');
	expect(result.identity.requestedRef).toBe('main');
	expect(artifactQuery.side).toBe('after');
	expect(artifactResult.bytes).toEqual(new Uint8Array([1, 2, 3]));
	recordExampleCases(
		{
			unitId: 'desktop.model.desktop-evidence-types', symbol: 'DesktopEvidence',
			state: 'represents-desktop-evidence-query-and-capture-shapes',
			evidence: 'examples-cases', file: 'represents-desktop-evidence-query-and-capture-shapes.json'
		},
		[{ name: 'current query and captured artifact', input: { query, artifactQuery }, output: {
			queryMode: query.mode, requestedRef: result.identity.requestedRef,
			artifactSide: artifactQuery.side, artifactBytes: Array.from(artifactResult.bytes)
		} }]
	);
});
