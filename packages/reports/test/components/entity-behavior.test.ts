import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntityBehavior from '../../src/components/explorer-ui/EntityBehavior.svelte';
import { explorerReading } from '../../src/utils/explorer-reading/explorerReading';
import { observedRows, rows } from '../artifactCaseDocs';
import { servedArtifacts } from '../entityArtifacts';
import { record, revision } from '../entityFixture';
import { answers, nav, place, view, type View } from '../entityPlaces';
import { count, disclosed, words } from '../entityRender';
import { commits, ids } from '../entityUnits';

const filter = { category: 'functions' as const, entity: ids.filter };
const route = place(filter);

/** The panel as the overview mounts it, with the results read first when a fetcher is given. */
async function panel(at: View, fetcher?: ReturnType<typeof servedArtifacts>) {
	const behavior = answers(at, ids.filter).behavior;
	const read = fetcher ? await explorerReading(behavior, '/media/', fetcher) : null;
	const props = { behavior, read, scope: at.scope, mediaBase: '/media/', nav: nav(route) };
	return render(EntityBehavior, { props }).body;
}

test('nothing is called unchanged before the results were read, and nothing crashes without them', async () => {
	const body = await panel(view('commit'));
	expect(words(body)).toContain('Reading the recorded results…');
	expect(words(body)).not.toMatch(/Behavior unchanged|Behavior changed/);
	expect(words(body)).toContain('Reading what it holds…');
	// An entity with no headless result at all renders its gap, not an error.
	const bare = await panel(view('current', { head: revision(commits.tip, []) }));
	expect(words(bare)).toContain('No end-to-end result is recorded for this entity at ccccccc.');
});

test('both sides show what their run was given and observed as rows, and its steps and assertions on request', async () => {
	const at = view('commit');
	const body = await panel(at, servedArtifacts([at.head, at.parent!]));
	expect(words(body)).toContain('Behavior unchanged');
	const sides = ['Before · aaaaaaa', 'After · bbbbbbb'];
	const from = (side: string) => body.indexOf(`aria-label="${side}"`);
	for (const [position, side] of sides.entries()) {
		const pane = body.slice(from(side), position === 0 ? from(sides[1]) : undefined);
		// The input and what was observed for it are a row that is read at once, on each side.
		expect(rows(pane)).toEqual(observedRows);
		expect(words(pane)).toContain('Search text Text SERVICE');
		expect(words(pane)).toContain('Order 1042 · Service call');
		expect(words(pane)).not.toContain('Actual output');
		// What else the run recorded is under one disclosure of that side, named for what it holds.
		expect(pane).toContain('<summary>Assertions and recorded result</summary>');
		expect(disclosed(pane)).toContain('Open the orders page');
		expect(disclosed(pane)).toContain('Matching order is listed');
		// A structured step stays structured, and what an assertion expected is beside it.
		expect(disclosed(pane)).toContain('"action": "search"');
		expect(disclosed(pane)).toContain('"expected": 12');
	}
	// The rows need nothing pressed, and no button loads anything.
	expect(count(body, /<button[^>]*>\s*(Show|Load|Open)\b/g)).toBe(0);
	expect(words(body)).not.toContain('Reading what it holds…');
});

test('a changed answer is said to be a change, with where it differs beside the result', async () => {
	const at = view('commit');
	const fetcher = servedArtifacts([at.head, at.parent!], {
		[commits.middle]: (stated, state) =>
			state === 'match' && 'output' in stated ? { ...stated, output: ['Order 7 · Other'] } : stated
	});
	const body = await panel(at, fetcher);
	expect(words(body)).toContain('Behavior changed');
	expect(words(body)).toContain('differs at output[0]');
	expect(words(body)).toContain('Order 7 · Other');
	expect(words(body)).toContain('Order 1042 · Service call');
	expect(words(body)).not.toContain('Behavior unchanged');
});

test('the branch tip shows one run with its payload, and no before or after', async () => {
	const at = view('current');
	const body = await panel(at, servedArtifacts([at.head]));
	expect(words(body)).toContain('Current end-to-end behavior');
	expect(words(body)).toContain('Current snapshot · ccccccc');
	expect(words(body)).toContain('Order 1042 · Service call');
	expect(words(body)).not.toMatch(/Before ·|After ·|Behavior unchanged/);
});

test('bytes that do not have the recorded hash are shown as unverified, never as a result', async () => {
	const at = view('commit');
	const fetcher = servedArtifacts([at.head, at.parent!]);
	// The record of the commit names another hash than the bytes that are served for it.
	const forged = record(commits.middle);
	const body = await panel({ ...at, head: revision(commits.middle, [forged]) }, fetcher);
	expect(words(body)).toContain('Behavior unknown');
	expect(words(body)).toContain('do not have the recorded SHA-256');
	const after = body.slice(body.indexOf('aria-label="After · bbbbbbb"'));
	expect(words(after)).not.toContain('Matching order is listed');
});
