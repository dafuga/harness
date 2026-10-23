import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntityRun from '../../src/components/explorer-ui/EntityRun.svelte';
import { entityBehavior } from '../../src/utils/entityBehavior';
import { answers, view } from '../entityPlaces';
import { verdicts, words } from '../entityRender';
import { ids } from '../entityUnits';

/** One side of the run of the filter, before anything of it was read. */
function side(lost: boolean) {
	const shown = entityBehavior(answers(view('commit'), ids.filter).behavior);
	const props = {
		shown,
		side: 'after' as const,
		title: 'After · bbbbbbb',
		role: 'Selected commit'
	};
	return render(EntityRun, { props: { ...props, mediaBase: '/media/', lost } }).body;
}

test('a result is said to be read while it is, and only then', () => {
	expect(words(side(false))).toContain('Reading what it holds…');
});

test('a result whose reading failed says so, and does not go on saying it is being read', () => {
	const body = side(true);
	expect(words(body)).not.toContain('Reading what it holds');
	expect(words(body)).toContain('It could not be read and checked against its hash.');
	expect(verdicts(body).map((mark) => mark.name)).toContain('Not verified');
	// What was recorded can still be opened as the file it is.
	expect(body).toContain('href="/media/bbbbbbb-match-output.json"');
});
