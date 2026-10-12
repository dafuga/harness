import { expect, test } from 'vitest';
import { record, revision } from '../entityFixture';
import { content, count, verdicts, words } from '../entityRender';
import { commits, ids, scenarios } from '../entityUnits';

const page = { category: 'pages' as const, entity: ids.page };
const filter = { category: 'functions' as const, entity: ids.filter };
const shots = (body: string) =>
	[...body.matchAll(/<img[^>]*src="\/harness\/media\/([^"]+)"/g)].map((match) => match[1]);

test('an overview shows contract, size and performance, and nothing of the source', () => {
	const body = content('commit', filter);
	for (const heading of ['Contract', 'Size', 'Performance profile']) {
		expect(body).toContain(`aria-label="${heading}"`);
	}
	expect(words(body)).toContain('Inputs orders, search text');
	expect(words(body)).toContain('Source size 800 B');
	expect(words(body)).toContain('Not measured');
	expect(words(body)).toContain('thousand orders');
	expect(words(body)).toContain('5%');
	expect(words(body)).not.toMatch(/src\/|\.ts\b|filterOrders|v-app\./);
	expect(words(body)).not.toMatch(/provenance/i);
});

test('a page at a selected commit shows the parent and the commit for one state and viewport', () => {
	const body = content('commit', page);
	expect(words(body)).toContain('Commit comparison');
	expect(words(body)).toContain('Before · aaaaaaa Parent commit');
	expect(words(body)).toContain('After · bbbbbbb Selected commit');
	expect(shots(body)).toEqual(['aaaaaaa-default-desktop.png', 'bbbbbbb-default-desktop.png']);
	// The later tip is never a side of the comparison.
	expect(body).not.toContain('ccccccc');
	expect(words(body)).toContain('Behavior change');
	expect(body).toContain(`/commit/${commits.middle}/pages/${ids.page}?tab=tests`);
});

test('a page at the branch tip shows exactly one screenshot and no before or after', () => {
	const body = content('current', page);
	expect(words(body)).toContain('Current screenshot');
	expect(words(body)).toContain('Current snapshot · ccccccc Branch tip');
	expect(shots(body)).toEqual(['ccccccc-default-desktop.png']);
	expect(words(body)).not.toMatch(/Before ·|After ·|Parent commit|Commit comparison/);
	// A person may pick another state or viewport of the same scenario.
	expect(body).toMatch(/<select[^>]*aria-label="State"/);
	expect(count(body, /aria-pressed="(true|false)"/g)).toBe(2);
	expect(body).toContain(`/commit/${commits.tip}/pages/${ids.page}`);
});

test('a side with no capture of the state is a stated gap, never the other side picture', () => {
	const parent = revision(commits.first, []);
	const body = content('commit', page, { parent });
	expect(shots(body)).toEqual(['bbbbbbb-default-desktop.png']);
	expect(verdicts(body)).toContainEqual({ passed: false, name: 'No capture', reasons: [] });
	// Why there is none is read on the page, in the pane of the side that lacks it.
	expect(words(body)).toContain(
		'Before · aaaaaaa Parent commit No verification record is attached to this commit.'
	);
});

test('a component no visual scenario names keeps the screenshot pane, as a stated gap', () => {
	const named = scenarios.map((scenario) => ({
		...scenario,
		units: scenario.units.filter((unit) => unit !== ids.card)
	}));
	const [head, parent] = [commits.middle, commits.first].map((commit) => {
		const found = revision(commit, [record(commit)]);
		return { ...found, registry: { ...found.registry, scenarios: named } };
	});
	const card = { category: 'components' as const, entity: ids.card };
	const body = content('commit', card, { head, parent });
	// It does not become the end-to-end view of a function: each side says nothing is captured.
	expect(words(body)).toContain('Commit comparison');
	expect(words(body)).not.toContain('End-to-end');
	const gap = 'No scenario with a viewport names this entity, so no screenshot of it is recorded';
	expect(words(body)).toContain(`Before · aaaaaaa Parent commit ${gap} at aaaaaaa.`);
	expect(words(body)).toContain(`After · bbbbbbb Selected commit ${gap} at bbbbbbb.`);
	expect(shots(body)).toEqual([]);
	const tip = content('current', card, { head: { ...head, commit: commits.tip } });
	expect(words(tip)).toContain(`Current snapshot · ccccccc Branch tip ${gap} at ccccccc.`);
	expect(words(tip)).not.toMatch(/Before ·|After ·/);
});

test('a page lists its components as components, each a link in the same scope', () => {
	const body = content('commit', page);
	expect(words(body)).toContain('Components on this page');
	expect(body).toContain(`/commit/${commits.middle}/components/${ids.list}`);
	expect(words(body)).toContain('App route');
	expect(words(body)).toContain('/orders');
	expect(words(body)).toContain('Details');
});

test('a function at a selected commit shows its end-to-end results before and after', () => {
	const body = content('commit', filter);
	expect(words(body)).toContain('End-to-end test comparison');
	expect(words(body)).toContain('Before · aaaaaaa Parent commit');
	expect(words(body)).toContain('After · bbbbbbb Selected commit');
	// Nothing is called unchanged before the recorded results were read.
	expect(words(body)).toContain('Reading the recorded results…');
	expect(words(body)).not.toContain('Behavior unchanged');
	expect(words(body)).toContain('Search across synthetic orders · match');
	expect(words(body)).toContain('Matches orders regardless of case.');
	expect(body).toContain('href="/harness/media/bbbbbbb-match-output.json"');
	expect(count(body, /<img/g)).toBe(0);
});

test('a function at the branch tip shows one run, and an unrecorded one is a cross', () => {
	const body = content('current', filter);
	expect(words(body)).toContain('Current end-to-end behavior');
	expect(words(body)).toContain('Current snapshot · ccccccc Branch tip');
	expect(words(body)).not.toMatch(/Before ·|Behavior unchanged/);
	expect(words(body)).toContain('E2E duration 40 ms');
	const bare = content('current', filter, { head: revision(commits.tip, []) });
	expect(verdicts(bare).every((badge) => !badge.passed)).toBe(true);
	expect(verdicts(bare).map((badge) => badge.name)).toContain('Evidence missing');
	expect(words(bare)).toContain('No end-to-end result is recorded for this entity at ccccccc.');
	expect(words(bare)).toContain('E2E duration Not measured');
});

test('a behaviour that cannot be established is unknown and shown as failed', () => {
	const body = content('commit', filter, { parent: revision(commits.first, []) });
	expect(words(body)).toContain('Behavior unknown');
	expect(words(body)).not.toContain('Behavior unchanged');
});

test('a config shows what it provides and who uses it, with no screenshot and no benchmark', () => {
	const body = content('current', { category: 'configs', entity: ids.settings });
	expect(words(body)).toContain('Current configuration');
	expect(words(body)).toContain('page size');
	expect(words(body)).toContain('Used by');
	expect(words(body)).toContain('Orders page');
	expect(count(body, /<img/g)).toBe(0);
	expect(words(body)).not.toMatch(/End-to-end|Current screenshot/);
	const changed = record(commits.middle);
	expect(
		content(
			'commit',
			{ category: 'configs', entity: ids.settings },
			{
				head: revision(commits.middle, [changed])
			}
		)
	).toContain('Values at');
});
