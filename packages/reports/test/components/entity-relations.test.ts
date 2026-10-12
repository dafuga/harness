import { expect, test } from 'vitest';
import { content, words } from '../entityRender';
import { commits, ids } from '../entityUnits';

const sections = (body: string) =>
	[...body.matchAll(/<section class="ex-card" aria-label="([^"]+)"/g)].map((match) => match[1]);

test('relationships are four kinds of their own, plus what uses the entity', () => {
	const body = content('commit', {
		category: 'components',
		entity: ids.list,
		tab: 'relationships'
	});
	expect(sections(body)).toEqual([
		'Components',
		'Functions',
		'Configs',
		'Services',
		'Used on pages',
		'Used by'
	]);
	expect(words(body)).not.toMatch(/sub-?components|\brelated\b/i);
	expect(words(body)).not.toMatch(/src\/|\.ts\b/);
});

test('each related entity is a link to it in the same branch and commit', () => {
	const body = content('commit', {
		category: 'components',
		entity: ids.list,
		tab: 'relationships'
	});
	const base = `/harness/branch/feature%2Forders/commit/${commits.middle}`;
	expect(body).toContain(`href="${base}/components/${ids.card}"`);
	expect(body).toContain(`href="${base}/functions/${ids.filter}"`);
	expect(body).toContain(`href="${base}/services/${ids.store}"`);
	expect(body).toContain(`href="${base}/pages/${ids.page}"`);
	expect(words(body)).toContain('It reads no config.');
});

test('a page leads to its components and a component to the components inside it', () => {
	const page = content('current', { category: 'pages', entity: ids.page, tab: 'relationships' });
	expect(page).toContain(`href="/harness/branch/feature%2Forders/components/${ids.list}"`);
	expect(page).toContain(`href="/harness/branch/feature%2Forders/configs/${ids.settings}"`);
	const tabs = [...page.matchAll(/role="tab"[^>]*>(.*?)<\/(?:a|button)>/gs)].map((match) =>
		words(match[1]).trim()
	);
	expect(tabs).toEqual(['Overview', 'Relationships', 'Tests', 'History']);
});
