import { expect, test } from 'vitest';
import { explorerEvidence } from '../../../reports/src/utils/explorerEvidence';
import { explorerVerdict } from '../../../reports/src/utils/explorerVerdict';
import { recordedProjection } from '../../src/utils/recordedProjection';
import { feed, head, held, home, parent, sampleDetail, sampleScope } from '../recorded-sample';

const revisions = () => ({ head: sampleDetail(head), parent: sampleDetail(parent) });
const full = (entity: string) => explorerEvidence(sampleScope(entity), revisions(), { id: entity });
const ids = (items: Array<{ id: string }> = []) => items.map((item) => item.id);

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

test('the projection derives the same evidence and verdict, and leaves its input alone', () => {
	const evidence = full(home);
	const untouched = structuredClone(evidence);
	const projected = recordedProjection(evidence, home);
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
});

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
