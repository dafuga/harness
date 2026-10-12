import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntityFrame from '../../src/components/harness/EntityFrame.svelte';
import type { ExplorerEntity } from '../../src/models/Explorer.types';
import { hostProps, verdicts, words } from '../entityRender';
import { ids } from '../entityUnits';

const children = createRawSnippet((entity: () => ExplorerEntity) => ({
	render: () => `<p>screen of ${entity().id}</p>`
}));
const framed = (entity: string) =>
	render(EntityFrame, {
		props: { host: hostProps('commit', { category: 'components', entity }), children }
	}).body;

test('an entity screen is headed by the entity, and is handed the entity it shows', () => {
	const body = framed(ids.list);
	expect(body).toMatch(/<h1[^>]*>Order list<\/h1>/);
	expect(verdicts(body)[0]).toMatchObject({ passed: true, name: 'Full coverage passed' });
	expect(words(body)).toContain(`screen of ${ids.list}`);
	expect(body).toContain('aria-label="Order list sections"');
});

test('an entity the revision does not hold has no header and no screen, only that it is missing', () => {
	const body = framed('app.component.gone');
	expect(words(body)).toContain('Not at this revision');
	expect(words(body)).toContain('Nothing from another revision is shown in its place.');
	// The only heading is that it is missing: no name, no tabs and no screen of another revision.
	expect(body).toMatch(/<h1[^>]*>Not at this revision<\/h1>/);
	expect(body).not.toContain('sections"');
	expect(words(body)).not.toContain('screen of');
});
