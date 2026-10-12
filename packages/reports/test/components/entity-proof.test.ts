import { expect, test } from 'vitest';
import { record, revision } from '../entityFixture';
import { content, count, words } from '../entityRender';
import { commits, ids, scenarios } from '../entityUnits';

const page = { category: 'pages' as const, entity: ids.page };
const filter = { category: 'functions' as const, entity: ids.filter };

test('a function shows its end-to-end behaviour first, even when a screenshot scenario names it', () => {
	const head = revision(commits.middle, [record(commits.middle)]);
	// The page scenario also proves the filter downstream; that does not make the filter a picture.
	head.registry = {
		...head.registry,
		scenarios: scenarios.map((scenario) =>
			scenario.id === 'orders-page'
				? { ...scenario, units: [...scenario.units, ids.filter] }
				: scenario
		)
	};
	const body = content('commit', filter, { head });
	expect(words(body)).toContain('End-to-end test comparison');
	expect(words(body)).not.toMatch(/Commit comparison|Current screenshot/);
	expect(count(body, /<img/g)).toBe(0);
	// The captures of the page it is seen on stay in its tests, where every capture is listed.
	const tests = content('commit', { ...filter, tab: 'tests' }, { head });
	expect(tests).toContain('/harness/media/bbbbbbb-default-desktop.png');
});

test('size and timing are read from the record the verdict is judged by: the newest of this commit', () => {
	const older = record(commits.middle);
	const newer = {
		...record(commits.middle),
		id: 'rec-newer',
		finishedAt: '2026-10-09T12:00:00.000Z'
	};
	newer.measurements = newer.measurements.map((item) =>
		item.unit === ids.filter && item.metric === 'source-bytes' ? { ...item, value: 900 } : item
	);
	const body = content('commit', filter, { head: revision(commits.middle, [older, newer]) });
	expect(words(body)).toContain('Source size 900 B');
	expect(words(body)).not.toContain('Source size 800 B');
});

test('a record of another commit measures nothing here, however new it is', () => {
	const foreign = {
		...record(commits.first),
		id: 'rec-foreign',
		finishedAt: '2026-10-09T13:00:00.000Z'
	};
	const body = content('commit', filter, { head: revision(commits.middle, [foreign]) });
	expect(words(body)).toContain('Source size Not measured');
	expect(words(body)).not.toContain('800 B');
});

test('the branch tip never shows a capture it inherited as its current screenshot', () => {
	const taken = record(commits.tip);
	taken.scenarios = taken.scenarios.map((scenario) => ({
		...scenario,
		inherited: true,
		origin: { record: 'rec-aaaaaa-0000', commit: commits.first }
	}));
	const body = content('current', page, { head: revision(commits.tip, [taken]) });
	expect(words(body)).toContain('Current screenshot');
	expect(count(body, /class="ex-shot"/g)).toBe(0);
	expect(words(body)).toMatch(/No capture|not captured/i);
	expect(words(body)).not.toContain('Current snapshot · ccccccc Branch tip Fresh');
});
