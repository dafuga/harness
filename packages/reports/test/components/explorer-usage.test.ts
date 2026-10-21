import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import ExplorerUsage from '../../src/components/ExplorerUsage.svelte';
import { hostProps, words } from '../entityRender';
import { commits, ids } from '../entityUnits';

for (const mode of ['current', 'commit'] as const) {
	test(`shared usage footers render links and empty usage at ${mode} scope`, () => {
		const host = hostProps(mode);
		const nav = { route: host.route, href: host.lens.href, go: host.onroute };
		const props = { nav, lens: host.lens, mediaBase: host.mediaBase };
		const consumers = host.entities.filter((item) => item.id === ids.list || item.id === ids.store);
		const body = render(ExplorerUsage, { props: { ...props, consumers } }).body;
		expect(words(body)).toContain('Used In');
		const base = `/harness/branch/feature%2Forders${mode === 'commit' ? `/commit/${commits.middle}` : ''}`;
		expect(body).toContain(`href="${base}/components/${ids.list}"`);
		expect(body).toContain(`href="${base}/services/${ids.store}"`);
		expect(body).not.toContain('<img');
		const empty = render(ExplorerUsage, { props: { ...props, consumers: [] } }).body;
		expect(words(empty).trim()).toBe('Used In —');
		expect(empty).not.toContain('<a');
	});
}
