import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { _electron, expect, test } from '../../../../test/support/browserTest';
import type { ElectronApplication, Page } from '../../../../test/support/browserTest';
import scenario from '../../../../specification/scenarios/mac-tracker-inbox.json' with { type: 'json' };
import { captureMacInbox } from './support/macTrackerInboxEvidence';
import { TrackerItemReadRepository } from '../../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRunReadRepository } from '../../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerLocalApiService } from '../../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../../src/services/projects-sessions/TrackerPersistenceService';
import {
	electronFixtureEnvironment,
	makeTemporaryDesktopEntry,
	seedHostedPage,
	startHubSpy
} from './support/trackerOverviewPublisherFixture';

const desktopRoot = resolve(import.meta.dirname, '../..');
const title = 'Fixture Mac decision';
const firstQuestion = 'Proceed with the fixture review?';
const nextQuestion = 'Proceed with the revised fixture review?';

test.setTimeout(120_000);

function post(api: TrackerLocalApiService, path: string, body: object) {
	return api.handle(
		new Request(`http://127.0.0.1${path}`, { method: 'POST', body: JSON.stringify(body) })
	);
}

function serve(api: TrackerLocalApiService) {
	return createServer(async (request, response) => {
		try {
			const chunks: Buffer[] = [];
			for await (const chunk of request) chunks.push(chunk);
			const message = new Request(`http://127.0.0.1${request.url}`, {
				method: request.method,
				body: chunks.length ? Buffer.concat(chunks) : undefined
			});
			const reply = await api.handle(message);
			response.writeHead(reply.status, Object.fromEntries(reply.headers));
			response.end(await reply.text());
		} catch {
			response.writeHead(500).end();
		}
	});
}

async function redirectTracker(app: ElectronApplication, port: number) {
	await app.evaluate((_electron, port) => {
		const original = globalThis.fetch;
		globalThis.fetch = ((input, init) => {
			if (!String(input).startsWith('http://127.0.0.1:7701/')) return original(input, init);
			const url = new URL(String(input));
			url.port = String(port);
			return original(url, init);
		}) as typeof fetch;
	}, port);
}

async function stage(page: Page, action: string, text: string) {
	await page.getByRole('button', { name: action, exact: true }).click();
	await page.getByRole('textbox').fill(text);
	await page.getByRole('button', { name: 'Review before sending' }).click();
	await expect(page.getByRole('group', { name: 'Confirm this write' })).toBeVisible();
}

const confirm = (page: Page) => page.getByRole('button', { name: 'Confirm and send' }).click();

for (const viewport of scenario.viewports)
	test.describe(viewport.id, () => {
		test(`Mac Needs you reviews and confirms writes (${viewport.id})`, async ({
			browserErrors
		}) => {
			const database = new DatabaseSync(':memory:');
			const now = () => Date.UTC(2026, 10, 21, 12);
			const store = new TrackerPersistenceService(database, 'fixture-mac', { now });
			const items = new TrackerItemReadRepository(database);
			const api = new TrackerLocalApiService(store, items, {
				now,
				runs: new TrackerRunReadRepository(database, store.node)
			});
			const server = serve(api);
			const temp = await mkdtemp(join(tmpdir(), 'harness-mac-inbox-'));
			const hub = await startHubSpy();
			let app: ElectronApplication | undefined;
			try {
				const id = 'fixturemac';
				store.appendLocal({ itemId: id, fields: { title, project: 'Fixture', status: 'open' } });
				database.exec(
					`CREATE TABLE runs(id INTEGER, item_id TEXT, queued_at INTEGER, state TEXT, rung TEXT, outcome TEXT)`
				);
				database
					.prepare("INSERT INTO runs VALUES (1, ?, ?, 'finished', 'sol', 'done')")
					.run(id, now());
				expect((await post(api, `/items/${id}/stage`, { stage: 'detail' })).status).toBe(200);
				expect(
					(
						await post(api, `/items/${id}/artifact`, {
							stage: 'detail',
							artifact: {
								links: [
									{ label: 'Mac wireframe', url: 'https://example.test/mac.png', kind: 'image' }
								]
							}
						})
					).status
				).toBe(200);
				await post(api, `/items/${id}/flag`, { question: firstQuestion });
				await post(api, `/items/${id}/note`, { text: 'Synthetic initial note' });
				const listening = once(server, 'listening');
				server.listen(0, '127.0.0.1');
				await listening;
				const address = server.address();
				if (!address || typeof address === 'string')
					throw new Error('Fixture Tracker failed to bind');
				app = await _electron.launch({
					executablePath: createRequire(import.meta.url)('electron') as string,
					args: [await makeTemporaryDesktopEntry(temp, desktopRoot)],
					env: { ...electronFixtureEnvironment(), HARNESS_HUB_ORIGIN: hub.origin }
				});
				await redirectTracker(app, address.port);
				browserErrors.watch(app.context());
				const page = await seedHostedPage(app, join(temp, 'profile'), hub);
				await page.setViewportSize({ width: viewport.width, height: viewport.height });
				await exerciseInbox(page, api, items, id);
			} finally {
				await app?.close();
				await hub.close();
				if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
				database.close();
				await rm(temp, { force: true, recursive: true });
			}
		});
	});

async function exerciseInbox(
	page: Page,
	api: TrackerLocalApiService,
	items: TrackerItemReadRepository,
	id: string
) {
	const homeLink = page.getByRole('link', { name: 'Needs you', exact: true });
	const hasLink = (await homeLink.count()) === 1;
	if (hasLink) await homeLink.click();
	else await page.evaluate(() => (location.pathname = '/tracker'));
	await expect(page).toHaveURL(/\/tracker$/);
	await page.reload();
	await expect(
		page
			.getByRole('heading', { name: 'Needs you', exact: true })
			.or(page.getByRole('status').filter({ hasText: 'paired iPhone' }))
	).toBeVisible();
	if (hasLink) await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible();
	await captureMacInbox(page, 'list');
	expect(hasLink).toBe(true);
	await page.getByRole('button', { name: new RegExp(title) }).click();
	await expect(page.getByText(firstQuestion, { exact: true })).toBeVisible();
	await expect(page.getByText('Synthetic initial note', { exact: true })).toBeVisible();
	await expect(page.getByText('finished', { exact: true })).toBeVisible();
	await captureMacInbox(page, 'detail');
	const planning = page.getByRole('region', { name: 'Planning stages' });
	await expect(planning.getByRole('link', { name: 'Mac wireframe' })).toBeVisible();
	await expect(planning.getByText(/Promoted by fixture-mac/)).toBeVisible();
	await stage(page, 'Add note', 'Mac confirmed note');
	await captureMacInbox(page, 'confirm-note');
	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	expect(items.get(id).notes_log.map(({ text }) => text)).toEqual(['Synthetic initial note']);
	await stage(page, 'Add note', 'Mac confirmed note');
	await confirm(page);
	await expect(page.getByText('Note saved to Tracker.')).toBeVisible();
	await expect(page.getByText('Mac confirmed note', { exact: true })).toBeVisible();
	await answerAndFlag(page, api, items, id);
}

async function answerAndFlag(
	page: Page,
	api: TrackerLocalApiService,
	items: TrackerItemReadRepository,
	id: string
) {
	await stage(page, 'Answer flag', 'Stale fixture answer');
	await captureMacInbox(page, 'confirm-answer');
	await post(api, `/items/${id}/flag`, { question: nextQuestion });
	await confirm(page);
	await expect(page.getByText(nextQuestion, { exact: true })).toBeVisible();
	await expect(page.getByText(/changed since you reviewed/i).first()).toBeVisible();
	expect(items.get(id).answer).toBeNull();
	await page.getByRole('button', { name: 'Review again' }).click();
	await expect(page.getByRole('button', { name: 'Review before sending' })).toHaveCount(0);
	await stage(page, 'Answer flag', 'Mac confirmed answer');
	await expect(page.getByRole('group', { name: 'Confirm this write' })).toContainText(nextQuestion);
	await confirm(page);
	await expect(page.getByText('Answer saved to Tracker.')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Flag answered' })).toBeVisible();
	expect(items.get(id).answer).toBe('Mac confirmed answer');
	await page.getByRole('button', { name: 'Review again' }).click();
	await stage(page, 'Flag for you', 'Follow up on the fixture?');
	await captureMacInbox(page, 'confirm-flag');
	await confirm(page);
	await expect(page.getByText('Flag saved to Tracker.')).toBeVisible();
	expect(items.get(id)).toMatchObject({
		question: 'Follow up on the fixture?',
		needs_daniel: true
	});
}
