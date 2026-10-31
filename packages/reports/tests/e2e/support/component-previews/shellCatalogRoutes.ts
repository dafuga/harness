import type { Page } from '@playwright/test';
import { revision, record } from '../../../../test/entityFixture';

/** Hold or refuse the real data requests before the console mounts. */
export async function routeShellCatalog(page: Page, id: string, variant: string) {
	if (id === 'reports.component.harness-entity-behavior' && variant === 'loading')
		await page.route('**/media/**', async () => {
			await new Promise<void>((resolve) => page.once('close', () => resolve()));
		});
	if (id !== 'reports.component.harness-harness-console' || !variant || variant === 'missing')
		return;
	const waiting = variant.startsWith('loading-');
	const history = variant === 'loading-history' || variant === 'index-error';
	const path = history ? '**/data/index.json' : '**/data/revisions/*.json';
	await page.route(path, async (route) => {
		if (waiting) {
			await new Promise<void>((resolve) => page.once('close', () => resolve()));
			return;
		}
		if (variant === 'unindexed') {
			const commit = new URL(route.request().url()).pathname.split('/').pop()!.replace('.json', '');
			const head = revision(commit, [record(commit)]);
			await route.fulfill({
				json: {
					...head,
					registry: {
						...head.registry,
						available: false,
						gap: 'This selected revision has no unit registry'
					}
				}
			});
		} else await route.fulfill({ contentType: 'application/json', body: '{' });
	});
	// An invalid payload exercises the client's handled parsing failure without network console errors.
	if (variant === 'index-error')
		await page.route('**/data/activity.json', (route) =>
			route.fulfill({ json: { repository: { name: 'Preview project' } } })
		);
}
