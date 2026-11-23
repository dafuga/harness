import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { captureProvenance, scenarioOrigin } from '../../src/utils/reports-media/captureProvenance';
import type { Scenario } from '../../src/utils/reports-media/captureProvenance.types';
import type { HarnessRecord, HarnessCapture } from '../../src/models/explorer-ui/Harness.types';

const revision = '0123456789abcdef0123456789abcdef01234567';
const record = {
	id: 'record_01J9Q0A1B2C3D4E5F6G7H8J9K',
	status: 'passed',
	valid: true,
	problems: [],
	source: { commit: revision, base: null },
	profile: 'default',
	startedAt: '2026-11-15T18:40:00.000Z',
	finishedAt: '2026-11-15T18:42:00.000Z',
	failures: [],
	tests: [],
	scenarios: [],
	measurements: [],
	budgets: { findings: [] }
} satisfies HarnessRecord;
const scenario = {
	id: 'capture-provenance-review',
	status: 'passed',
	testedRevision: revision,
	inherited: false,
	origin: { record: record.id, commit: '89abcdef0123456789abcdef0123456789abcdef' },
	states: []
} satisfies Scenario;
const capture = {
	evidence: 'capture-provenance-screenshot',
	kind: 'screenshot',
	state: 'overview',
	viewport: 'desktop',
	status: 'passed',
	path: 'capture.png',
	sha256: 'a'.repeat(64),
	mediaType: 'image/png',
	capturedAt: '2026-11-15T18:42:00.000Z',
	provenance: 'actual-capture',
	server: { buildId: 'build-2026-11-15-1842', revision },
	media: 'media/capture.png'
} satisfies HarnessCapture;

test('Capture provenance separates source from verification target', () => {
	const result = captureProvenance(record, scenario, capture);
	expect(result).toMatchObject({ standing: 'fresh', label: 'Fresh capture' });
	const input = {
		record: record.id,
		target: revision,
		scenario: scenario.id,
		capture: capture.evidence
	};
	recordExampleCases(
		{
			unitId: 'reports.function.capture-provenance',
			symbol: 'captureProvenance',
			state: 'capture-provenance-separates-source-from-verification-target',
			evidence: 'examples-cases',
			file: 'capture-provenance-separates-source-from-verification-target.json'
		},
		[{ name: 'passing screenshot records its actual build', input, output: result }]
	);
});

test('Scenario origin summarizes tested and captured revisions', () => {
	const failed = {
		...scenario,
		status: 'failed',
		states: [{ id: 'overview', coverage: 'complete', captures: [capture] }]
	} satisfies Scenario;
	const result = scenarioOrigin(failed);
	expect(result).toContain('Failed attempt at 0123456');
	const input = {
		testedRevision: failed.testedRevision,
		captureRevision: revision,
		status: failed.status
	};
	recordExampleCases(
		{
			unitId: 'reports.function.capture-provenance',
			symbol: 'scenarioOrigin',
			state: 'scenario-origin-summarizes-tested-and-captured-revisions',
			evidence: 'examples-cases',
			file: 'scenario-origin-summarizes-tested-and-captured-revisions.json'
		},
		[{ name: 'failed attempt includes its tested revision', input, output: result }]
	);
});
