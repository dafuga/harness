import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { artifactQuery } from '../../src/utils/reports-media/artifactQuery';
import type {
	EntityEvidenceQuery,
	EntityEvidenceResult
} from '../../src/models/verification-evidence/DesktopEvidence.types';
import type {
	ExplorerCapture,
	ExplorerSide
} from '$reports/models/explorer-ui/ExplorerEvidence.types';
import type { HarnessCapture, HarnessRecord } from '$reports/models/explorer-ui/Harness.types';
import type { ExplorerScope } from '$reports/models/explorer-ui/Explorer.types';

const UNIT_ID = 'desktop.function.artifact-query';
const PROJECT_ID = 'local-5e0c9a21d7b44f83a6c10e2f9b57d3c84a1f06be9d2c75e83f0b6a19c4d27e5f';
const COMMIT = '9b1e4c7a2d6f08e5c3a1b9d7f2e4c6a8b0d1e3f5';
const PARENT = '3c7f2a9e1b5d8046f2c9e7a1d3b5f8c0e2a4d6b8';
const NOTES = 'a6c3e9f1d7b2054e8c1a3f6d9b0e2c7a4f8d5b13';
const EVIDENCE_REVISION = '7d2b5f8e1a4c9036b2e7d5f0a8c1e4b9d3f6a270';
const SIDE_RECORD = '5e8c1f4a9d2b7e03c6a1f8d5b2e9c4a7f0d3b6e1c8a5f2d9b4e7c0a3f6d1b8e2';
const FOCUSED_RECORD = '1d9f3b7e5a2c8041f6e3b9d7a0c2f5e8b1d4a6c39e7f2b5d8a0c3e6f9b2d4a71';
const SHA = '2f9a6c1e8b4d7053a9e2c6f1b8d4a7e0c3f5b9d2a6e1c8f4b7d0a3e5c9f2b6d1';
const STORED = `${SHA}.png`;
const AT = '2026-11-12T09:15:58.440Z';

const SCOPE: EntityEvidenceQuery = {
	projectId: PROJECT_ID,
	entityId: 'desktop.component.runtime-evidence',
	commit: COMMIT,
	branch: 'main',
	mode: 'commit'
};

/** A stored or unstored HarnessCapture; the bytes are named by `media` alone. */
function harnessCapture(evidence: string, media: string | null, viewport?: string): HarnessCapture {
	return {
		evidence,
		kind: 'screenshot',
		state: 'current',
		...(viewport ? { viewport } : {}),
		status: 'passed',
		path: `evidence/${COMMIT}/runtime-evidence-ui/${evidence}.png`,
		sha256: SHA,
		mediaType: 'image/png',
		capturedAt: AT,
		media
	};
}

/** The explorer listing of a capture. Focused records are optional, as in the stored answer. */
function listed(capture: HarnessCapture, focused?: string): ExplorerCapture {
	return {
		scenario: 'runtime-evidence-ui',
		state: 'current',
		capture,
		standing: 'fresh',
		...(focused ? { focused: { loop: 'runtime', status: 'passed', record: focused } } : {}),
		usable: true,
		current: true,
		inheritedFrom: null
	};
}

function sideOf(captures: ExplorerCapture[], record: string | null): ExplorerSide {
	return {
		commit: COMMIT,
		detail: null,
		record: record ? ({ id: record } as HarnessRecord) : null,
		captures,
		coverage: [],
		gap: null
	};
}

/** The evidence answer around the sides. The function reads only evidence and identity, so scope and behavior are minimal. */
function resultOf(after: ExplorerSide, before: ExplorerSide | null = null): EntityEvidenceResult {
	return {
		scope: {
			location: { entity: SCOPE.entityId, commit: COMMIT },
			commit: COMMIT
		} as ExplorerScope,
		identity: {
			notesRevision: NOTES,
			evidenceRevision: EVIDENCE_REVISION
		} as EntityEvidenceResult['identity'],
		evidence: {
			mode: 'commit',
			scenarios: [],
			after,
			before,
			initial: before ? null : PARENT,
			incomparable: []
		},
		behavior: { mode: 'commit', rows: [], summary: 'unknown', reason: null, scenarios: [] }
	};
}

const focusedCapture = listed(
	harnessCapture('runtime-screens-desktop', STORED, 'desktop'),
	FOCUSED_RECORD
);
const plainCapture = listed(harnessCapture('runtime-plain', `${'0'.repeat(64)}.txt`));
const unstoredCapture = listed(harnessCapture('runtime-unstored', null, 'desktop'));

test('Builds the request for a stored capture named by its filename', () => {
	const result = resultOf(sideOf([focusedCapture, unstoredCapture], SIDE_RECORD));
	const query = artifactQuery(result, SCOPE, 'after', STORED);

	expect(query).toEqual({
		...SCOPE,
		side: 'after',
		recordId: FOCUSED_RECORD,
		scenarioId: 'runtime-evidence-ui',
		state: 'current',
		evidenceId: 'runtime-screens-desktop',
		viewport: 'desktop',
		sha256: SHA,
		notesRevision: NOTES,
		evidenceRevision: EVIDENCE_REVISION
	});

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'artifactQuery',
			state: 'builds-the-request-for-a-stored-capture-named-by-filename',
			evidence: 'examples-cases',
			file: 'builds-the-request-for-a-stored-capture-named-by-filename.json'
		},
		[
			{
				name: 'stored after capture named by filename with a focused record',
				input: { side: 'after', file: STORED, scope: SCOPE.entityId },
				output: query
			}
		]
	);
});

test('Keeps the side record when the capture has no focused record', () => {
	const capture = listed(harnessCapture('runtime-plain', `${'0'.repeat(64)}.txt`));
	const result = resultOf(sideOf([capture], SIDE_RECORD));
	const query = artifactQuery(result, SCOPE, 'after', capture);

	expect(query).toMatchObject({
		side: 'after',
		recordId: SIDE_RECORD,
		evidenceId: 'runtime-plain',
		viewport: null,
		sha256: SHA
	});

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'artifactQuery',
			state: 'keeps-the-side-record-when-the-capture-has-no-focused-record',
			evidence: 'examples-cases',
			file: 'keeps-the-side-record-when-the-capture-has-no-focused-record.json'
		},
		[
			{
				name: 'stored capture passed by identity without a viewport',
				input: { side: 'after', file: 'listed capture object', recordOnSide: SIDE_RECORD },
				output: query
			}
		]
	);
});

test('Returns null for a missing side, capture or record', () => {
	const result = resultOf(sideOf([focusedCapture, unstoredCapture], SIDE_RECORD));
	const noRecord = resultOf(sideOf([plainCapture], null));
	const copy = { ...focusedCapture };

	const cases = [
		{
			name: 'before side with no parent',
			input: { side: 'before', file: STORED },
			output: artifactQuery(result, SCOPE, 'before', STORED)
		},
		{
			name: 'filename that the side does not list',
			input: { side: 'after', file: 'not-listed.png' },
			output: artifactQuery(result, SCOPE, 'after', 'not-listed.png')
		},
		{
			name: 'equal copy of a listed capture',
			input: { side: 'after', file: 'equal copy object' },
			output: artifactQuery(result, SCOPE, 'after', copy)
		},
		{
			name: 'capture whose bytes are not stored',
			input: { side: 'after', file: 'unstored capture object' },
			output: artifactQuery(result, SCOPE, 'after', unstoredCapture)
		},
		{
			name: 'capture without a focused record on a side with no record',
			input: { side: 'after', file: 'plain capture object', recordOnSide: null },
			output: artifactQuery(noRecord, SCOPE, 'after', plainCapture)
		}
	];

	for (const item of cases) expect(item.output).toBeNull();

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'artifactQuery',
			state: 'returns-null-for-a-missing-side-capture-or-record',
			evidence: 'examples-cases',
			file: 'returns-null-for-a-missing-side-capture-or-record.json'
		},
		cases.map(({ name, input, output }) => ({ name, input, output }))
	);
});
