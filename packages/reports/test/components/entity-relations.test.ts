import { expect, test } from 'vitest';
import { content, verdicts, words } from '../entityRender';
import { commits, ids } from '../entityUnits';

const sections = (body: string) =>
	[...body.matchAll(/<section class="ex-card" aria-label="([^"]+)"/g)].map((match) => match[1]);

const list = { category: 'components', entity: ids.list } as const;
/** The section of what a component uses, then the section of what uses it. */
const both = (mode: 'commit' | 'current' = 'commit') =>
	[content(mode, { ...list, tab: 'uses' }), content(mode, { ...list, tab: 'used-in' })] as const;

test('what an entity uses is one section of kinds of their own, and what uses it is another', () => {
	for (const mode of ['current', 'commit'] as const) {
		const [uses, used] = both(mode);
		expect([sections(uses), sections(used)]).toEqual([['Uses'], ['Used In']]);
		expect(words(uses)).toMatch(/Components\s+1[^]*Order card[^]*Functions\s+1[^]*Services\s+1/);
		expect(words(uses + used)).not.toMatch(/sub-?components|\brelated\b/i);
		expect(words(uses + used)).not.toMatch(/src\/|\.ts\b/);
		expect(uses, 'Relationships reuse catalog cards').toContain('ex-function-tile');
		expect(uses).toContain('ex-page-card');
		expect(uses).toContain('aria-label="Services"');
		expect(used).toContain('ex-page-card');
		expect(words(used)).toMatch(/Used In\s+1\s+Pages\s+1[^]*Orders page/);
		expect(used).toContain('aria-label="Used In"');
		expect(uses).toContain('aria-label="Used In"');
		for (const body of [uses, used]) {
			expect(
				verdicts(body.slice(body.indexOf('class="ex-relations"'))),
				'usage rows omit verification marks'
			).toHaveLength(0);
			expect(verdicts(/<header class="ex-head"[^]*?<\/header>/.exec(body)![0])).toHaveLength(1);
		}
	}
});

test('each related entity is a link to it in the same branch and commit', () => {
	const [uses, used] = both();
	const base = `/harness/branch/feature%2Forders/commit/${commits.middle}`;
	expect(uses).toContain(`href="${base}/components/${ids.card}"`);
	expect(uses).toContain(`href="${base}/helpers/filterOrders/in/${ids.filter}/contract"`);
	expect(uses).toContain(`href="${base}/services/${ids.store}"`);
	expect(used).toContain(`href="${base}/pages/${ids.page}"`);
	// A kind the entity uses nothing of is left out; it is not listed as an empty one.
	expect(words(uses)).not.toContain('Configs');
});

test('a page leads to its components and a component to the components inside it', () => {
	const page = content('current', { category: 'pages', entity: ids.page, tab: 'uses' });
	expect(page).toContain(`href="/harness/branch/feature%2Forders/components/${ids.list}"`);
	expect(page).toContain(`href="/harness/branch/feature%2Forders/configs/${ids.settings}"`);
	const tabs = [...page.matchAll(/role="tab"[^>]*>(.*?)<\/(?:a|button)>/gs)].map((match) =>
		words(match[1]).trim()
	);
	expect(tabs).toEqual(['Overview', 'Contract', 'Uses', 'States', 'History', 'Source']);
});
