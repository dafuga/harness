import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import ExplorerUsageLink from '../../src/components/ExplorerUsageLink.svelte';
import { hostProps, words } from '../entityRender';
import { ids } from '../entityUnits';

test('preview triggers are real entity links without eager screenshot payloads', () => {
	const host = hostProps('commit');
	const entity = host.entities.find((item) => item.id === ids.list)!;
	const body = render(ExplorerUsageLink, {
		props: {
			entity,
			lens: host.lens,
			mediaBase: host.mediaBase,
			nav: { route: host.route, href: host.lens.href, go: host.onroute }
		}
	}).body;
	expect(words(body).trim()).toBe('Order list');
	expect(body).toContain('/components/app.component.order-list');
	expect(body).not.toMatch(/<img|role="tooltip"/);
});
