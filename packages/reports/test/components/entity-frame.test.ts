import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntityFrame from '../../src/components/harness/EntityFrame.svelte';
import type { ExplorerEntity } from '../../src/models/Explorer.types';
import { hostProps, verdicts, words } from '../entityRender';
import { ids } from '../entityUnits';
import { impacted, revision, sha, unit } from '../explorerFixture';

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

test.each(['retired', 'absent'] as const)(
	'a removed private function retains its parent contract when the head entry is %s',
	(status) => {
		const prior = unit('function.private', 'function', {
			title: 'privateHelper',
			helpers: [],
			contract: { inputs: [{ name: 'originalInput', type: 'string' }], outputs: [], errors: [] }
		});
		const parent = revision([prior], [], [], { commit: sha('b') });
		const impact = impacted(parent.commit);
		impact.units.removed = [prior.id];
		const held =
			status === 'retired' ? [{ ...prior, status: 'retired' as const, title: 'Tombstone' }] : [];
		const head = revision(held, [], [], { sourceImpact: impact });
		const host = hostProps('commit', { category: 'functions', entity: prior.id }, { head, parent });
		const contract = createRawSnippet((entity: () => ExplorerEntity) => ({
			render: () => `<p>${entity().unit.contract.inputs[0]?.name}</p>`
		}));
		const body = render(EntityFrame, { props: { host, children: contract } }).body;
		expect(body, 'removed private functions retain the parent contract').toContain(
			'aria-label="Removed at this commit"'
		);
		expect(words(body)).toContain('originalInput');
		expect(body).toMatch(/<h1[^>]*>Private helper<\/h1>/);
		expect(words(body)).not.toContain('Tombstone');
		expect(host.entities).toEqual([]);
		const unrelated = { ...host, head: { ...head, sourceImpact: null } };
		expect(words(render(EntityFrame, { props: { host: unrelated, children } }).body)).toContain(
			'Not at this revision'
		);
		expect(
			words(render(EntityFrame, { props: { host: { ...host, parent: null }, children } }).body)
		).toContain('Not at this revision');
	}
);
