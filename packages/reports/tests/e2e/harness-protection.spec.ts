import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { currentRefs, revision, seeded } from './support/harnessHistory';

const { commits, refs } = seeded();
const port = Number(process.env.PROJECT_REPORTS_E2E_PORT || 5589);
const lockedPort = Number(process.env.HARNESS_CONSOLE_E2E_LOCKED_PORT || 5591);
const exposedPort = Number(process.env.HARNESS_CONSOLE_E2E_EXPOSED_PORT || 5592);
const media = revision(commits.reordered)
	.records.flatMap((record) => record.scenarios)
	.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
	.find((capture) => capture.kind === 'screenshot' && capture.media);
const protectedPaths = [
	'/harness',
	'/harness/reports',
	'/harness/analytics',
	'/harness/data/index.json',
	`/harness/data/revisions/${commits.reordered}.json`,
	`/harness/${media?.media}`,
	`/harness/export/${commits.reordered}`,
	'/api/reports'
];

test('former report and analytics routes lead into the console', async ({ page }) => {
	const id = (await readFile('/tmp/project-reports-e2e/fixture-id', 'utf8')).trim();
	await page.goto('/');
	await expect(page).toHaveURL(/\/harness\/reports$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Project reports' })).toBeVisible();
	await page.goto(`/reports/${id}`);
	await expect(page).toHaveURL(new RegExp(`/harness/reports/${id}$`));
	await expect(page.locator('.gallery-section')).toBeVisible();
	await page.goto('/analytics?days=30');
	await expect(page).toHaveURL(/\/harness\/analytics\?days=30$/);
	await page.goto('/harness');
	await expect(page.getByRole('link', { name: 'Reports' })).toHaveAttribute(
		'href',
		'/harness/reports'
	);
	await expect(page.getByRole('link', { name: 'Analytics' })).toHaveAttribute(
		'href',
		'/harness/analytics'
	);
});

test('the local owner reaches every page and file from the loopback address', async ({
	request
}) => {
	for (const path of protectedPaths) {
		const response = await request.get(path);
		expect([path, response.status()]).toEqual([path, 200]);
	}
	const image = await request.get(`/harness/${media?.media}`);
	expect(image.headers()['content-type']).toBe('image/png');
	expect(image.headers()['cache-control']).toContain('private');
});

test('without an owner policy nothing is served, whatever the request claims', async ({
	request
}) => {
	const spoofed = {
		host: `127.0.0.1:${port}`,
		'x-forwarded-for': '127.0.0.1',
		forwarded: 'for=127.0.0.1'
	};
	for (const path of [...protectedPaths, '/', '/reports/anything', '/analytics']) {
		for (const headers of [{}, spoofed]) {
			const response = await request.get(`http://127.0.0.1:${lockedPort}${path}`, {
				headers,
				maxRedirects: 0
			});
			expect([path, response.status()]).toEqual([path, 403]);
			expect(await response.text()).not.toContain(commits.reordered);
		}
	}
});

test('owner mode trusts the peer address, not the Host header', async ({ request }) => {
	const lan = Object.values(networkInterfaces())
		.flat()
		.find((address) => address?.family === 'IPv4' && !address.internal)?.address;
	test.skip(!lan, 'this machine has no non-loopback IPv4 address to connect from');
	const local = await request.get(`http://127.0.0.1:${exposedPort}/harness/data/index.json`);
	expect(local.status()).toBe(200);
	for (const path of protectedPaths) {
		const response = await request.get(`http://${lan}:${exposedPort}${path}`, {
			headers: { host: `127.0.0.1:${exposedPort}`, 'x-forwarded-for': '127.0.0.1' },
			maxRedirects: 0
		});
		expect([path, response.status()]).toEqual([path, 403]);
	}
});

test('history and media are fetched on demand and are not part of the page or its scripts', async ({
	page
}) => {
	const scripts: string[] = [];
	page.on('response', async (response) => {
		const type = response.headers()['content-type'] ?? '';
		if (type.includes('javascript') || type.includes('text/html')) {
			scripts.push(await response.text().catch(() => ''));
		}
	});
	await page.goto('/harness');
	await page.waitForLoadState('networkidle');
	const record = revision(commits.reordered).records[0].id;
	for (const text of scripts) {
		expect(text).not.toContain(commits.baseline);
		expect(text).not.toContain(record);
	}
	expect(scripts.length).toBeGreaterThan(1);
});

test('looking at history changes nothing in the repository that is inspected', async ({ page }) => {
	for (const view of ['map', 'compare', 'history', 'growth']) {
		await page.goto(`/harness?view=${view}&commit=${commits.reordered}`);
		await expect(page.getByRole('tab', { selected: true })).toBeVisible();
	}
	const download = await page.request.get(`/harness/export/${commits.reordered}`);
	expect(download.status()).toBe(200);
	expect(download.headers()['content-disposition']).toContain('attachment');
	expect(await download.text()).toContain('window.projectReport');
	expect(currentRefs()).toBe(refs.trim());
});
