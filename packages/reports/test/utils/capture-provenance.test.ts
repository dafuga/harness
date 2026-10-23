import type { Scenario } from './capture-provenance.test.types';
import { expect, test } from 'vitest';
import type { HarnessCapture, HarnessRecord } from '../../src/models/Harness.types';
import { harnessEvidence } from '../../src/utils/harnessEvidence';
import { captureProvenance, scenarioOrigin } from '../../src/utils/captureProvenance';

const target = 'a'.repeat(40);
const older = 'b'.repeat(40);
const id = '1'.repeat(64);
const origin = '2'.repeat(64);

function capture(extra: Partial<HarnessCapture> = {}): HarnessCapture {
	return {
		evidence: 'screens',
		kind: 'screenshot',
		state: 'empty',
		viewport: 'desktop',
		status: 'passed',
		path: 'evidence/empty-desktop.png',
		sha256: 'c'.repeat(64),
		mediaType: 'image/png',
		capturedAt: '2026-10-10T18:00:00.000Z',
		server: { buildId: 'build-7', revision: target },
		media: `media/${'c'.repeat(64)}.png`,
		...extra
	};
}
function scenario(captures: HarnessCapture[], extra: Partial<Scenario> = {}): Scenario {
	return {
		id: 'titles-page',
		status: 'passed',
		testedRevision: target,
		inherited: false,
		origin: { record: id, commit: target },
		states: [{ id: 'empty', coverage: 'required', captures }],
		...extra
	};
}
function record(scenarios: Scenario[], extra: Partial<HarnessRecord> = {}): HarnessRecord {
	return {
		id,
		status: 'passed',
		valid: true,
		problems: [],
		source: { commit: target, base: null },
		profile: 'p1',
		startedAt: '2026-10-10T18:00:00.000Z',
		finishedAt: '2026-10-10T18:00:01.000Z',
		failures: [],
		tests: [],
		scenarios,
		measurements: [],
		budgets: { findings: [] },
		...extra
	};
}
const value = (facts: Array<{ label: string; value: string }>, label: string) =>
	facts.find((fact) => fact.label === label)?.value;
function judged(item: HarnessCapture, changes: Partial<Scenario> = {}, extra = {}) {
	const tested = scenario([item], changes);
	return captureProvenance(record([tested], extra), tested, item);
}

test('a fresh accepted capture names its own build and the passing attempt', () => {
	const fresh = judged(capture());
	expect(fresh.standing).toBe('fresh');
	expect(fresh.facts).toEqual([
		{ label: 'Standing', value: 'Fresh capture' },
		{ label: 'Captured from', value: 'build build-7 of aaaaaaaaaaaa' },
		{ label: 'Verification attempt', value: 'record 111111111111 (passed) targeting aaaaaaaaaaaa' }
	]);
	expect(fresh.note).toBe(
		`Captured from build build-7 of revision ${target}. Tested at aaaaaaa by passing record 111111111111.`
	);
});

test('a rejected capture of another build is never credited to the targeted revision', () => {
	const stale = capture({ status: 'failed', server: { buildId: 'build-3', revision: older } });
	const judgedStale = judged(stale, { status: 'failed' }, { status: 'failed' });
	expect(judgedStale.label).toBe('Rejected capture from another revision');
	expect(value(judgedStale.facts, 'Captured from')).toBe('build build-3 of bbbbbbbbbbbb');
	expect(value(judgedStale.facts, 'Verification attempt')).toBe(
		'record 111111111111 (failed) targeting aaaaaaaaaaaa'
	);
	expect(judgedStale.note).toContain(`Captured from build build-3 of revision ${older}.`);
	expect(judgedStale.note).toContain(`which targeted revision ${target}`);
	expect(judgedStale.note).not.toContain('Tested at');
	expect(scenarioOrigin(scenario([stale], { status: 'failed' }))).toBe(
		'Failed attempt at aaaaaaa; captures came from bbbbbbb'
	);
});

test('a capture that names no build claims none, whether rejected or accepted', () => {
	const unstamped = judged(
		capture({ status: 'failed', server: undefined }),
		{ status: 'failed' },
		{ status: 'failed' }
	);
	expect(unstamped.label).toBe('Rejected capture with no recorded build');
	expect(value(unstamped.facts, 'Captured from')).toBe(
		'not recorded: the capture names no build or revision'
	);
	expect(unstamped.note).toContain('The capture does not record which build or revision');

	const tone = capture({
		kind: 'audio',
		viewport: undefined,
		server: undefined,
		provenance: 'fixture'
	});
	const accepted = judged(tone);
	expect(accepted.label).toBe('Fresh capture');
	expect(value(accepted.facts, 'Provenance')).toBe(
		'fixture data, not a capture of running software'
	);
	expect(accepted.note).toContain(
		`Produced while record 111111111111 verified revision ${target}.`
	);
	expect(accepted.note).not.toContain('Tested at');
	// Fixture audio needs no build stamp, so its rejection is not blamed on a missing one.
	expect(judged({ ...tone, status: 'failed' }, {}, { status: 'failed' }).label).toBe(
		'Rejected capture'
	);
	const live = { ...tone, status: 'failed' as const, provenance: 'actual-capture' };
	expect(judged(live, {}, { status: 'failed' }).label).toBe(
		'Rejected capture with no recorded build'
	);
});

test('inherited evidence keeps its original record, revision and build', () => {
	const kept = capture({ server: { buildId: 'build-3', revision: older } });
	const inherited = judged(kept, {
		status: 'referenced',
		inherited: true,
		testedRevision: older,
		origin: { record: origin, commit: older }
	});
	expect(inherited.label).toBe('Inherited capture');
	expect(value(inherited.facts, 'Captured from')).toBe('build build-3 of bbbbbbbbbbbb');
	expect(value(inherited.facts, 'Inherited from')).toBe('record 222222222222 of bbbbbbbbbbbb');
	expect(inherited.note).toContain(
		`Inherited unchanged from record 222222222222 of revision ${older}; not captured again for revision ${target}.`
	);
	expect(inherited.note).not.toContain('Tested at');
});

test('nothing in a record that could not be validated reads as proof', () => {
	const unproven = judged(capture(), {}, { valid: false });
	expect(unproven.label).toBe('Unvalidated capture');
	expect(value(unproven.facts, 'Verification attempt')).toBe(
		'record 111111111111 (not validated) targeting aaaaaaaaaaaa'
	);
	expect(unproven.note).toContain('could not be validated, so this proves nothing');
	const tested = scenario([capture()]);
	const [item] = harnessEvidence(
		{ registry: { scenarios: [] } } as never,
		record([tested], { valid: false })
	);
	expect([item.status, item.standing, item.phase]).toEqual([
		'not-proven',
		'Unvalidated capture',
		undefined
	]);
});

test('an accepted capture in a failed attempt says the attempt failed', () => {
	const accepted = judged(capture(), {}, { status: 'failed' });
	expect(accepted.label).toBe('Fresh capture');
	expect(accepted.note).toContain(
		`Accepted on its own, but record 111111111111 failed for revision ${target}.`
	);
	expect(accepted.note).not.toContain('Tested at');
});
