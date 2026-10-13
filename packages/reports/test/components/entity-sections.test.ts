import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntitySections from '../../src/components/harness/EntitySections.svelte';
import { explorerEntities } from '../../src/utils/explorerEntities';
import { hostProps, words } from '../entityRender';
import { nav } from '../entityPlaces';
import { ids } from '../entityUnits';

const pane = createRawSnippet(() => ({ render: () => '<p>the evidence of its kind</p>' }));
function sections(tab?: 'uses' | 'tests') {
	const host = hostProps('commit', { category: 'pages', entity: ids.page, tab });
	const entity = explorerEntities(host.head).find((item) => item.id === ids.page)!;
	return render(EntitySections, { props: { host, entity, nav: nav(host.route), pane } }).body;
}

test('the overview is the summary of the entity, then the evidence of its kind', () => {
	const body = sections();
	expect(body).toContain('aria-label="Orders page overview"');
	expect(words(body)).toMatch(/Uses\s+3\s+Components\s+2\s+Order list/);
	expect(body.indexOf('aria-label="Contract"')).toBeLessThan(
		body.indexOf('the evidence of its kind')
	);
});

test('what it uses and its tests replace the overview, and its evidence pane with it', () => {
	const related = sections('uses');
	expect(related).toContain('aria-label="Orders page uses"');
	expect(words(related)).not.toContain('the evidence of its kind');
	const tests = sections('tests');
	expect(tests).toContain('aria-label="Orders page tests"');
	expect(words(tests)).toContain('Verification at bbbbbbb');
	expect(words(tests)).not.toContain('the evidence of its kind');
});
