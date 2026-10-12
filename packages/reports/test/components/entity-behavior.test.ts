import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntityBehavior from '../../src/components/harness/EntityBehavior.svelte';
import { explorerReading } from '../../src/utils/explorerReading';
import { servedArtifacts } from '../entityArtifacts';
import { record, revision } from '../entityFixture';
import { answers, nav, place, view, type View } from '../entityPlaces';
import { count, words } from '../entityRender';
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

test('both sides show what their run did at once: steps, input, output and assertions', async () => {
	const at = view('commit');
	const body = await panel(at, servedArtifacts([at.head, at.parent!]));
	expect(words(body)).toContain('Behavior unchanged');
	for (const side of ['Before · aaaaaaa', 'After · bbbbbbb']) {
		const pane = body.slice(body.indexOf(`aria-label="${side}"`));
		expect(words(pane)).toContain('Open the orders page');
		expect(words(pane)).toContain('"searchText": "SERVICE"');
		expect(words(pane)).toContain('Order 1042 · Service call');
		expect(words(pane)).toContain('Matching order is listed');
	}
	// A structured step stays structured, and what an assertion expected is beside it.
	expect(words(body)).toContain('"action": "search"');
	expect(words(body)).toContain('"expected": 12');
	// Nothing has to be pressed to see any of it.
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
