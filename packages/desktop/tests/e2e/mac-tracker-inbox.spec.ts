import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { _electron, expect, test } from '../../../../test/support/browserTest';
import type { ElectronApplication, Page } from '../../../../test/support/browserTest';
import scenario from '../../../../specification/scenarios/mac-tracker-inbox.json' with { type: 'json' };
import { captureMacInbox, verifyMacWireframeOpen } from './support/macTrackerInboxEvidence';
import { TrackerItemReadRepository } from '../../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRunReadRepository } from '../../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerLocalApiService } from '../../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerMachineService } from '../../../../src/services/projects-sessions/TrackerMachineService';
import { routePlanImage } from './support/trackerWorkFixture';
import { verifyMacSchedule, verifyPlanWork } from './support/trackerWorkEvidence';
import { TrackerPersistenceService } from '../../../../src/services/projects-sessions/TrackerPersistenceService';
import {
	electronFixtureEnvironment,
	makeTemporaryDesktopEntry,
	seedHostedPage,
	startHubSpy
} from './support/trackerOverviewPublisherFixture';
import {
	post,
	serve,
	isolateMacTrackerFixture,
	stage,
	writeOther,
	confirm,
	seedMacPlan
} from './support/macTrackerInboxActions';

const desktopRoot = resolve(import.meta.dirname, '../..');
const title = 'Fixture Mac decision';
const firstQuestion = 'Proceed with the fixture review?';
const nextQuestion = 'Proceed with the revised fixture review?';
const options = [
	{ label: 'Proceed', effect: 'Continues the fixture review.', recommended: true },
	{ label: 'Hold', effect: 'Waits for another look.' }
];

test.setTimeout(120_000);

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
				machines: new TrackerMachineService(store, { now }),
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
				await post(api, `/items/${id}/flag`, { question: firstQuestion, options });
				await post(api, `/items/${id}/note`, { text: 'Synthetic initial note' });
				const listening = once(server, 'listening');
				server.listen(0, '127.0.0.1');
				await listening;
				const address = server.address();
				if (!address || typeof address === 'string')
					throw new Error('Fixture Tracker failed to bind');
				app = await _electron.launch({
					executablePath: createRequire(import.meta.url)('electron') as string,
					args: [
						await makeTemporaryDesktopEntry(
							temp,
							desktopRoot,
							isolateMacTrackerFixture(address.port)
						)
					],
					env: { ...electronFixtureEnvironment(), HARNESS_HUB_ORIGIN: hub.origin }
				});
				browserErrors.watch(app.context());
				const page = await seedHostedPage(app, join(temp, 'profile'), hub);
				await page.setViewportSize({ width: viewport.width, height: viewport.height });
				await exerciseInbox(page, api, items, id);
				await verifyMacWireframeOpen(app, page);
				await seedMacPlan(store, api);
				await routePlanImage(page);
				await page.getByRole('link', { name: 'Home', exact: true }).click();
				await verifyPlanWork(page, `electron-${viewport.id}`);
				await verifyMacSchedule(page, `electron-${viewport.id}`, items);
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
	await page.getByRole('link', { name: 'Needs you', exact: true }).click();
	await page.getByRole('link', { name: 'All Tracker items', exact: true }).click();
	await expect(page).toHaveURL(/\/tracker$/);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Needs you', exact: true })).toBeVisible();
	// The overview shows one row per ask with its choices: recommended first, then Other.
	const row = page
		.getByRole('list', { name: 'Needs you' })
		.getByRole('button', { name: /Fixture.*waiting/s });
	await expect(row).toContainText(firstQuestion);
	await expect(page.getByRole('heading', { name: 'Blocked - needs you' })).toBeVisible();
	await expect(page.getByRole('list', { name: 'Needs you' }).locator('button.choice')).toHaveText([
		/Proceed.*Recommended/s,
		/Hold/,
		/Other/
	]);
	await expect(page.getByRole('textbox')).toHaveCount(0);
	await captureMacInbox(page, 'list');
	await row.click();
	const asked = page.locator('.flag[data-flag-state="open"]');
	await expect(asked.getByText(firstQuestion, { exact: true })).toBeVisible();
	await expect(asked.getByRole('button', { name: /Proceed.*Recommended/s })).toBeVisible();
	await expect(page.getByRole('textbox')).toHaveCount(0);
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
	await writeOther(page, 'Stale fixture answer');
	await captureMacInbox(page, 'confirm-answer');
	await post(api, `/items/${id}/flag`, { question: nextQuestion, options });
	await page.getByRole('button', { name: 'Send answer' }).click();
	await expect(page.getByText(nextQuestion, { exact: true })).toBeVisible();
	await expect(page.getByText(/changed since you reviewed/i).first()).toBeVisible();
	expect(items.get(id).answer).toBeNull();
	await page.getByRole('button', { name: 'Review again' }).click();
	await expect(page.getByRole('button', { name: 'Review before sending' })).toHaveCount(0);
	await writeOther(page, 'Mac confirmed answer');
	await expect(page.getByRole('dialog', { name: 'Other answer' })).toContainText(nextQuestion);
	await page.getByRole('button', { name: 'Send answer' }).click();
	await expect(page.getByText('Answer saved to Tracker.')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Flag answered' })).toBeVisible();
	expect(items.get(id).answer).toBe('Mac confirmed answer');
	await page.getByRole('button', { name: 'Review again' }).click();
	await stage(page, 'Flag for follow-up', 'Follow up on the fixture?');
	await captureMacInbox(page, 'confirm-flag');
	await confirm(page);
	await expect(page.getByText('Flag saved to Tracker.')).toBeVisible();
	expect(items.get(id)).toMatchObject({
		question: 'Follow up on the fixture?',
		needs_daniel: true
	});
}
