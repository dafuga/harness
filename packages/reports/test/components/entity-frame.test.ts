import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntityFrame from '../../src/components/harness/EntityFrame.svelte';
import type { ExplorerEntity } from '../../src/models/Explorer.types';
import { hostProps, verdicts, words } from '../entityRender';
import { ids } from '../entityUnits';
import { unit } from '../explorerFixture';
import { explorerEntities } from '../../src/utils/explorerEntities';
import { PerformanceProfileService } from '../../../../src/services/PerformanceProfileService';
import { evidenceRequested } from '../../../../src/utils/record-capture/recordCapture';

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

test.each(['active', 'retired', 'absent'] as const)(
	'a private function is resolved only from the proven %s revision state',
	async (state) => {
		const id = 'function.private';
		const host = hostProps('commit', { category: 'functions', entity: id });
		if (!host.parent || !host.head.sourceImpact) throw new Error('Expected a compared fixture.');
		const before = unit(id, 'function', { title: 'Private audit', helpers: [] });
		host.parent = {
			...host.parent,
			registry: { ...host.parent.registry, units: [...host.parent.registry.units, before] }
		};
		const current = state === 'absent' ? [] : [{ ...before, status: state }];
		host.head = {
			...host.head,
			registry: { ...host.head.registry, units: [...host.head.registry.units, ...current] },
			sourceImpact: {
				...host.head.sourceImpact,
				units: { ...host.head.sourceImpact.units, removed: state === 'retired' ? [id] : [] }
			}
		};
		host.entities = explorerEntities(host.head, host.parent);
		expect(host.entities.some((entity) => entity.id === id)).toBe(false);
		const body = render(EntityFrame, { props: { host, children } }).body;
		if (state === 'absent') {
			expect(words(body)).toContain('Not at this revision');
			expect(words(body)).not.toContain(`screen of ${id}`);
		} else {
			expect(body).toMatch(/<h1[^>]*>Private audit<\/h1>/);
			expect(words(body)).toContain(`screen of ${id}`);
			const breadcrumb = body.match(/<nav[^>]*aria-label="Breadcrumb"[\s\S]*?<\/nav>/)?.[0];
			expect(breadcrumb).toBeDefined();
			expect(words(breadcrumb!)).not.toContain('Helpers');
			if (state === 'retired') expect(words(body)).toContain('Removed at this commit');
			if (state === 'retired' && evidenceRequested())
				await new PerformanceProfileService().capture(
					{
						unit: 'reports.function.explorer-entities',
						workload: 'retired-private-frame-ssr',
						rounds: 3,
						iterations: 3,
						warmups: 1
					},
					() => render(EntityFrame, { props: { host, children } })
				);
		}
	}
);
