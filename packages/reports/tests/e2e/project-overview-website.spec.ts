import { expect, test, type Page } from '../../../../test/support/browserTest';
import { checkpoint, nav } from './support/explorer';
import { seeded } from './support/harnessHistory';

// The history is seeded for the explorer checks; the Projects page itself reads only its endpoint.
seeded();

const endpoint = '**/api/project-overview';

/** A synthetic tracker snapshot: one project, one live session and one computer. No real record. */
const ready = {
	status: 'ready',
	projects: [
		{
			agent: 'synthetic-project',
			state: 'active',
			liveSessions: 1,
			counts: { open: 0, in_progress: 1, blocked: 0, done: 0 },
			items: [
				{
					id: 'synthetic-item',
					title: 'Synthetic item',
					status: 'in_progress',
					updatedAt: '2026-11-20T10:00:00.000Z',
					due: null,
					live: true,
					stale: false
				}
			],
			attention: null,
			blocked: null,
			milestone: null,
			updatedAt: '2026-11-20T10:00:00.000Z'
		}
	],
	machines: [{ name: 'synthetic-computer', status: 'ok' }],
	liveSessions: 1
};

/** Answers the page's own read of the endpoint, as a tracker would, without a real tracker. */
async function serve(page: Page, body: unknown, status = 200) {
	await page.route(endpoint, (route) =>
		route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
	);
}

test('the Projects page shows the synthetic overview and highlights its nav link', async ({
	page
}) => {
	await serve(page, ready);
	await page.goto('/harness/projects');
	await expect(page.getByText('synthetic-project')).toBeVisible();
	await expect(nav(page).getByRole('link', { name: 'Projects' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await checkpoint(page, 'project-overview-website-ready');
});

test('an unavailable read is shown as unavailable and never as a project', async ({ page }) => {
	await serve(page, { status: 'unavailable' }, 503);
	await page.goto('/harness/projects');
	await expect(page.getByRole('alert')).toContainText('The tracker could not be reached');
	await expect(page.getByText('synthetic-project')).toHaveCount(0);
	await checkpoint(page, 'project-overview-website-unavailable');
});

test('the local explorer links to Projects, and the link opens the page', async ({ page }) => {
	await page.goto('/harness');
	const link = nav(page).getByRole('link', { name: 'Projects' });
	await expect(link).toHaveAttribute('href', '/harness/projects');
	await expect(link).not.toHaveAttribute('aria-current', 'page');
	await serve(page, ready);
	await link.click();
	await expect(page).toHaveURL(/\/harness\/projects$/);
	await expect(nav(page).getByRole('link', { name: 'Projects' })).toHaveAttribute(
		'aria-current',
		'page'
	);
});

test('the endpoint refuses a cross-site read and marks its response private', async ({ page }) => {
	const response = await page.request.get('/api/project-overview', {
		headers: { 'sec-fetch-site': 'cross-site' }
	});
	expect(response.status()).toBe(403);
	expect(response.headers()['cache-control']).toBe('no-store');
	expect(response.headers()['access-control-allow-origin']).toBeUndefined();
	expect(await response.json()).toEqual({ status: 'unavailable' });
});
