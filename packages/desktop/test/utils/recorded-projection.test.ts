import { afterAll, expect, test } from 'vitest';
import {
	evidenceRequested,
	recordCapture
} from '../../../../src/utils/record-capture/recordCapture';
import { explorerEvidence } from '../../../reports/src/utils/explorerEvidence';
import { explorerVerdict } from '../../../reports/src/utils/explorer-verdict/explorerVerdict';
import { recordedProjection } from '../../src/utils/recorded-answer/recordedProjection';
import { feed, head, held, home, parent, sampleDetail, sampleScope } from '../recorded-sample';

type Mode = 'direct' | 'same-tree' | 'changed-tree';
const tree = 'e'.repeat(40);
const origin = 'f'.repeat(40);
const revisions = (mode: Mode = 'direct') => {
	const found = { head: sampleDetail(head), parent: sampleDetail(parent) };
	if (mode === 'direct') return found;
	const original = found.head.records[0].scenarios[0].states[0].captures[0];
	const capture = {
		...original,
		bytes: 1,
		provenance: 'actual-capture',
		server: { buildId: 'build', revision: origin }
	};
	const green = {
		commit: origin,
		sourceTree: tree,
		status: 'passed',
		command: 'browser acceptance',
		assertion: 'the page renders',
		output: 'passed',
		finishedAt: '2026-10-21T10:00:00Z',
		captures: [{ unit: home, viewport: { width: 1440, height: 900 }, capture }]
	};
	const runs = [{ loop: 'recorded-evidence', units: [home], red: null, green }];
	Object.defineProperty(runs, Symbol.iterator, {
		value: () => {
			throw Error('Own iterator is not admission');
		}
	});
	Object.defineProperty(runs, 'constructor', {
		value: { [Symbol.species]: class extends Array {} }
	});
	Object.assign(found.head, { records: [], regressions: runs });
	Object.defineProperty(found.head, 'side', {
		enumerable: true,
		get: () => `sides/${mode === 'same-tree' ? tree : 'd'.repeat(40)}.json`
	});
	return found;
};
const full = (entity: string, mode: Mode = 'direct') =>
	explorerEvidence(sampleScope(entity), revisions(mode), { id: entity });
const ids = (items: Array<{ id: string }> = []) => items.map((item) => item.id);

afterAll(() => {
	if (!evidenceRequested()) return;
	const inputs = (['direct', 'same-tree', 'changed-tree'] as const).map((mode) => full(home, mode));
	const samples: number[] = [];
	for (let round = 0; round < 5; round++) {
		const start = performance.now();
		for (let iteration = 0; iteration < 100; iteration++)
			for (const input of inputs) recordedProjection(input, home);
		samples.push((performance.now() - start) / (100 * inputs.length));
	}
	const context = {
		unit: 'desktop.function.recorded-projection',
		callable: 'recordedProjection',
		workload: 'entity-evidence-projection',
		target: 'module',
		samples: 1500
	};
	const measurements = [
		{
			...context,
			metric: 'latency-warm-ms',
			unitOfMeasure: 'ms',
			value: samples.sort((a, b) => a - b)[2],
			method:
				'Median per call in five batches of 100 passes over direct, identical-tree and changed-tree evidence fixtures.'
		},
		{
			...context,
			metric: 'process-peak-rss-bytes',
			unitOfMeasure: 'bytes',
			value: process.resourceUsage().maxRSS * 1024,
			method:
				'Peak RSS of the whole Vitest benchmark process including runner overhead; not isolated projection memory.'
		}
	];
	recordCapture(
		{
			evidence: 'projection-benchmark',
			state: 'recorded-evidence',
			kind: 'benchmark',
			file: 'projection-benchmark.json',
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
});

test('a side keeps what judges this entity and nothing of another', () => {
	const projected = recordedProjection(full(home), home);
	for (const side of [projected.after, projected.before]) {
		const own = held(side);
		expect([own.units, own.scenarios, own.ran]).toEqual([[home], ['home-page'], ['home-page']]);
		expect([own.available, own.edges, own.measured, own.explained]).toEqual([
			true,
			[],
			[home],
			[home]
		]);
		const [record] = own.detail.records;
		expect(side?.record).toEqual(record);
		expect(record.budgets.findings.map((found) => found.unit)).toEqual([home]);
		expect(record.failures).toEqual([]);
		// Every test stays: the record does not say which unit a test file covers.
		expect(ids(record.tests)).toEqual(['home-page:run', 'feed-run:run', 'test/unit.test.ts']);
		expect(side?.captures.map((item) => item.scenario)).toEqual(['home-page']);
	}
	expect(recordedProjection(full(feed), feed).after.record?.failures).toEqual([
		`${feed}: a note of the feed alone`
	]);
});

test('what a commit changed is kept for this entity alone, and no file is named', () => {
	const { detail } = recordedProjection(full(feed), feed).after;
	const units = { direct: [], indirect: [feed], added: [], removed: [] };
	expect(detail?.comparison).toEqual({
		base: null,
		record: 'record-aaaa',
		units,
		scenarios: ['feed-run'],
		uncertain: []
	});
	expect(detail?.sourceImpact).toEqual({
		base: null,
		expanded: false,
		units,
		scenarios: ['feed-run'],
		uncertain: [],
		changed: []
	});
	expect(detail).not.toHaveProperty('side');
	expect(detail).not.toHaveProperty('rangeReasons');
});

test.each(['direct', 'same-tree', 'changed-tree'] as const)(
	'the projection re-derives %s evidence without filenames and leaves its input alone',
	(mode) => {
		const evidence = full(home, mode);
		const untouched = structuredClone(evidence);
		const projected = recordedProjection(evidence, home);
		expect(projected.after.detail).not.toHaveProperty('side');
		if (mode !== 'direct')
			expect(projected.after.captures).toHaveLength(mode === 'same-tree' ? 1 : 0);
		if (mode === 'same-tree') expect(projected.after.detail).toHaveProperty('sourceTree', tree);
		expect(evidence).toEqual(untouched);
		expect(JSON.stringify(projected).length).toBeLessThan(JSON.stringify(evidence).length);
		const again = { head: held(projected.after).detail, parent: held(projected.before).detail };
		expect(explorerEvidence(sampleScope(home), again, { id: home })).toEqual(projected);
		const [unit] = again.head.registry.units;
		expect(explorerVerdict(unit, again.head)).toEqual(
			explorerVerdict(unit, held(evidence.after).detail)
		);
		expect(projected.scenarios).toEqual(evidence.scenarios);
		expect(projected.after.captures).toEqual(evidence.after.captures);
		expect(projected.after.coverage).toEqual(evidence.after.coverage);
	}
);

test('a side whose revision is not held stays the gap it is', () => {
	const unheld = explorerEvidence(
		sampleScope(home),
		{ head: sampleDetail(head), parent: null },
		{ id: home }
	);
	const projected = recordedProjection(unheld, home);
	expect(projected.before).toEqual(unheld.before);
	expect(projected.before).toMatchObject({ detail: null, record: null, captures: [] });
	const alone = explorerEvidence(sampleScope(home, 'current'), revisions(), { id: home });
	expect(recordedProjection(alone, home).before).toBeNull();
});

test('regression proof reaches each transport for its own entity and exact side', () => {
	const evidence = full(home);
	const point = (commit: string, status: 'failed' | 'passed') => ({
		commit,
		status,
		command: 'bun test selected-item',
		assertion: 'Expected the selected item',
		output: status,
		finishedAt: '2026-10-18T09:00:00Z'
	});
	const proof = {
		loop: 'selected-item',
		units: [home],
		red: point(parent, 'failed'),
		green: point(head, 'passed')
	};
	const before = { ...proof, green: undefined };
	Object.assign(evidence.after.detail!, { regressions: [proof, { ...proof, units: [feed] }] });
	Object.assign(evidence.before!.detail!, { regressions: [before] });
	const untouched = structuredClone(evidence);
	const result = recordedProjection(evidence, home);
	expect(result.after.detail?.regressions).toEqual([proof]);
	expect(result.before?.detail?.regressions).toEqual([before]);
	expect(result.before?.detail?.regressions?.[0].green).toBeUndefined();
	expect(evidence).toEqual(untouched);
});
