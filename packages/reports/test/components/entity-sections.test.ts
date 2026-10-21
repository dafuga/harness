import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntitySections from '../../src/components/harness/entity-sections/EntitySections.svelte';
import { explorerEntities } from '../../src/utils/explorerEntities';
import { disclosed, hostProps, words } from '../entityRender';
import { nav } from '../entityPlaces';
import { ids } from '../entityUnits';

const pane = createRawSnippet(() => ({ render: () => '<p>the evidence of its kind</p>' }));
function sections(tab?: 'uses' | 'tests', purpose?: string) {
	const host = hostProps('commit', { category: 'pages', entity: ids.page, tab });
	const entity = explorerEntities(host.head).find((item) => item.id === ids.page)!;
	if (purpose !== undefined) entity.purpose = purpose;
	return render(EntitySections, { props: { host, entity, nav: nav(host.route), pane } }).body;
}

test('a page overview introduces its purpose before evidence and keeps usage in its tabs', () => {
	const body = sections();
	expect(body).toContain('aria-label="Orders page overview"');
	expect(words(body)).toContain('Lists the orders of an account.');
	expect(body.indexOf('Lists the orders of an account.')).toBeLessThan(
		body.indexOf('the evidence of its kind')
	);
	expect(sections(undefined, '')).not.toContain('class="ex-lead"');
	expect(body).not.toMatch(/aria-label="(?:Used In|Uses)"/);
	expect(body.indexOf('the evidence of its kind')).toBeLessThan(
		body.indexOf('aria-label="Performance profile"')
	);
	expect(body).not.toContain('aria-label="Size"');
	expect(body.match(/<summary>Measurements and frozen limits<\/summary>/g)).toHaveLength(1);
	expect(words(body)).not.toContain('Metric Measured Limit Note');
	expect(disclosed(body)).toContain('Metric Measured Limit Note');
});

test('what it uses and its tests replace the overview, and its evidence pane with it', () => {
	const related = sections('uses');
	expect(related).toContain('aria-label="Orders page uses"');
	expect(words(related)).not.toContain('the evidence of its kind');
	expect(words(related)).not.toContain('Lists the orders of an account.');
	const tests = sections('tests');
	expect(tests).toContain('aria-label="Orders page states"');
	expect(words(tests)).toContain('States');
	expect(words(tests)).not.toContain('Verification at bbbbbbb');
	expect(disclosed(tests)).toContain('Verification at bbbbbbb');
	expect(words(tests)).not.toContain('the evidence of its kind');
	expect(words(tests)).not.toContain('Lists the orders of an account.');
});
