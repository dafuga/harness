import { expect, test } from 'vitest';
import type { HarnessRecord, HarnessRevision } from '../../src/models/Harness.types';
import { explorerVerdict, verdictRecord } from '../../src/utils/explorerVerdict';
import {
	capture,
	complete,
	declared,
	impacted,
	record,
	result,
	revision,
	sha,
	unit
} from '../explorerFixture';

const page = unit('page.titles', 'page');
const proven = (records: HarnessRecord[], extra: Partial<HarnessRevision> = {}) =>
	explorerVerdict(page, revision([page], [declared()], records, extra));
const reasons = (records: HarnessRecord[], extra: Partial<HarnessRevision> = {}) =>
	proven(records, extra).reasons.join(' | ');

test('proven only when every required state and viewport has a passed capture of this commit', () => {
	const verdict = proven([record([result(complete())])]);
	expect(verdict).toEqual({ passed: true, label: 'Full coverage passed', reasons: [] });
});

test('a commit without a record proves nothing', () => {
	expect(proven([])).toMatchObject({ passed: false, label: 'Evidence missing' });
	expect(reasons([])).toContain('No verification record is attached to this commit');
});

test('a revision without a registry is not judged from another one', () => {
	const detail = revision([], [], [record([])]);
	detail.registry = { ...detail.registry, available: false, gap: 'No registry at this commit' };
	expect(explorerVerdict(page, detail)).toMatchObject({ passed: false, label: 'Evidence missing' });
});

test('a record that could not be validated is unusable, whatever it says', () => {
	const invalid = record([result(complete())], { valid: false, problems: ['bytes differ'] });
	expect(proven([invalid])).toMatchObject({ passed: false, label: 'Evidence unusable' });
	expect(reasons([invalid])).toContain('bytes differ');
});

test('the newest usable record decides, not an earlier one that passed', () => {
	const earlier = record([result(complete())], {
		id: 'r1',
		finishedAt: '2026-10-10T18:00:01.000Z'
	});
	const later = record([result(complete(), { status: 'failed' })], {
		id: 'r2',
		status: 'failed',
		finishedAt: '2026-10-10T19:00:00.000Z'
	});
	expect(verdictRecord(revision([page], [declared()], [later, earlier]))?.id).toBe('r2');
	expect(proven([earlier, later])).toMatchObject({ passed: false, label: 'Verification failed' });
	expect(proven([later, { ...earlier, finishedAt: '2026-10-10T20:00:00.000Z' }]).passed).toBe(true);
});

test('a missing viewport, state or scenario is incomplete coverage, never a share of it', () => {
	const oneViewport = record([result([capture()])]);
	expect(proven([oneViewport])).toMatchObject({ passed: false, label: 'Coverage incomplete' });
	expect(reasons([oneViewport])).toContain('empty at mobile');
	const noState = record([result([], { states: [] })]);
	expect(reasons([noState])).toContain('empty');
	expect(reasons([record([])])).toContain('Titles page has no result in the record');
	for (const verdict of [proven([oneViewport]), proven([noState]), proven([record([])])]) {
		expect(JSON.stringify(verdict)).not.toMatch(/%|percent|partial/i);
	}
});

test('a state the contract declares but nothing covers fails; an inapplicable one is not asked for', () => {
	const states = [
		{ id: 'empty', coverage: 'required' },
		{ id: 'offline', coverage: 'inapplicable', reason: 'Rendered on the server.' }
	];
	const detail = revision([page], [declared({ states })], [record([result(complete())])]);
	expect(explorerVerdict(page, detail).passed).toBe(true);
	const missing = [...states, { id: 'error', coverage: 'missing', reason: 'Not captured yet.' }];
	const lacking = revision([page], [declared({ states: missing })], [record([result(complete())])]);
	expect(explorerVerdict(page, lacking)).toMatchObject({
		passed: false,
		label: 'Coverage incomplete'
	});
	expect(explorerVerdict(page, lacking).reasons.join(' ')).toContain('Not captured yet.');
});

test('a failed capture, one without its bytes and one of another build all fail', () => {
	const failed = record([result([capture({ status: 'failed' }), complete()[1]])]);
	expect(proven([failed])).toMatchObject({ passed: false, label: 'Verification failed' });
	const gone = record([result([capture({ media: null, gap: 'not stored' }), complete()[1]])]);
	expect(proven([gone])).toMatchObject({ passed: false, label: 'Evidence missing' });
	const other = capture({ server: { buildId: 'build-0', revision: sha('b') } });
	const stale = record([result([other, complete()[1]])]);
	expect(proven([stale])).toMatchObject({ passed: false, label: 'Evidence stale' });
	expect(reasons([stale])).toContain('bbbbbbb');
});

test('inherited evidence stands only while a recorded impact shows the unit unaffected', () => {
	const origin = { record: 'r0', commit: sha('b') };
	const older = complete().map((item) => ({
		...item,
		server: { buildId: 'build-0', revision: sha('b') }
	}));
	const inherited = record(
		[
			result(older, {
				status: 'referenced',
				inherited: true,
				originTests: [{ id: 'titles-page:page', status: 'passed' }],
				testedRevision: sha('b'),
				origin
			})
		],
		{ tests: [] }
	);
	expect(proven([inherited], { sourceImpact: impacted(sha('b')) }).passed).toBe(true);
	const changed = { sourceImpact: impacted(sha('b'), ['page.titles']) };
	expect(proven([inherited], changed)).toMatchObject({ passed: false, label: 'Evidence stale' });
	expect(reasons([inherited], changed)).toContain('bbbbbbb');
});

test('a failed gate or test of the record leaves every unit of the commit unproven', () => {
	const gates = {
		snapshot: 'passed',
		registry: 'passed',
		tests: 'failed',
		scenarios: 'passed'
	} as const;
	const tests = [
		{ id: 'a.test.ts', kind: 'unit', target: 'a.test.ts', status: 'failed' as const, durationMs: 1 }
	];
	const failing = record([result(complete())], { status: 'failed', gates, tests });
	expect(proven([failing])).toMatchObject({ passed: false, label: 'Verification failed' });
	expect(reasons([failing])).toContain('a.test.ts');
	const unknown = record([result(complete())], { tests: [{ ...tests[0], status: 'skipped' }] });
	expect(proven([unknown]).passed).toBe(false);
});

test('a budget finding counts for its own unit only', () => {
	const finding = {
		unit: 'page.titles',
		metric: 'source-bytes',
		status: 'exceeded',
		baseline: 1,
		measured: 2
	};
	const over = record([result(complete())], { budgets: { findings: [finding] } });
	expect(proven([over])).toMatchObject({ passed: false, label: 'Verification failed' });
	const elsewhere = record([result(complete())], {
		budgets: { findings: [{ ...finding, unit: 'function.other' }] }
	});
	expect(proven([elsewhere]).passed).toBe(true);
	const stated = record([result(complete())], {
		budgets: { findings: [{ ...finding, status: 'unavailable', baseline: null, measured: null }] }
	});
	expect(proven([stated]).passed).toBe(true);
});

test('what no scenario covers is not proven by tests alone, and a config is no exception', () => {
	const lone = unit('function.lone', 'function');
	const detail = revision([lone], [declared()], [record([result(complete())])]);
	expect(explorerVerdict(lone, detail)).toMatchObject({
		passed: false,
		label: 'Coverage incomplete'
	});
	expect(explorerVerdict(lone, detail).reasons.join(' ')).toContain('No scenario covers');
	const config = unit('config.site', 'config');
	expect(explorerVerdict(config, revision([config], [], [record([])])).passed).toBe(false);
	const covered = declared({ units: ['config.site'] });
	const proven = revision([config], [covered], [record([result(complete())])]);
	expect(explorerVerdict(config, proven).passed).toBe(true);
});

test('a record that states no gates or ran no test proves nothing', () => {
	const gateless = record([result(complete())], { gates: undefined });
	expect(proven([gateless])).toMatchObject({ passed: false, label: 'Evidence unusable' });
	expect(reasons([gateless])).toContain('states no gates');
	const untested = record([result(complete())], { tests: [] });
	expect(proven([untested])).toMatchObject({ passed: false, label: 'Coverage incomplete' });
	expect(reasons([untested])).toContain('ran no test');
	const lacking = { snapshot: 'passed', registry: 'passed', scenarios: 'passed' } as const;
	expect(proven([record([result(complete())], { gates: lacking })]).passed).toBe(false);
});
