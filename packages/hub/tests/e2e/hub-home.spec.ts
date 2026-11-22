import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildStamp } from '../../../../src/utils/buildStamp';
import {
	evidenceRequested,
	recordCapture
} from '../../../../src/utils/reports-media/record-capture/recordCapture';
import { expect, test, type Page } from '../../../../test/support/browserTest';
import { hubHomeFixture } from './hub-home-fixture';
import type { CapturePosition, HomeFixture } from './hub-home-fixture.types';
import manifest from '../../../../specification/scenarios/hub-home.json' with { type: 'json' };
const screens = [
	{ id: 'agents', title: 'Agents' },
	{ id: 'quota', title: 'Quota' },
	{ id: 'plans', title: 'Plans' },
	{ id: 'scheduled', title: 'Scheduled' },
	{ id: 'projects', title: 'Projects' },
	{ id: 'wip', title: 'Work in progress' }
] as const;
test.setTimeout(90000);
for (const viewport of manifest.viewports) {
	for (const scheme of ['dark', 'light'] as const) {
		for (const mode of ['default', 'busy', 'empty', 'loading'] as const) {
			test(`Hub home ${viewport.id} ${scheme} ${mode}`, async ({ page }) => {
				await page.setViewportSize({ width: viewport.width, height: viewport.height });
				await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
				const fixture = await hubHomeFixture(page, mode);
				await page.goto('/');
				await expect(page).toHaveTitle('Harness · Home');
				await expect(page.getByRole('heading', { level: 1 })).toHaveText(
					mode === 'loading'
						? 'Loading your home…'
						: mode === 'empty'
							? 'Nothing is running yet'
							: /working, .* need[s]? you/
				);
				if (mode === 'default' || mode === 'busy') {
					await expect(page.locator('.hh-projects .hh-change').first()).toBeVisible();
				}
				await fit(page, viewport.width);
				const path = [viewport.id, scheme, mode] as const;
				await capture(page, path, 'root');
				const fullMatrix =
					mode === 'default' || (scheme === 'dark' && ['phone', 'laptop'].includes(viewport.id));
				if (fullMatrix) await dialogs(page, path, fixture);
				if (mode === 'loading') {
					fixture.release();
					await expect(page.getByRole('heading', { level: 1 })).toHaveText(
						/working, .* need[s]? you/
					);
				}
			});
		}
	}
}

async function dialogs(page: Page, position: CapturePosition, fixture: HomeFixture) {
	for (const screen of screens) {
		const card = page.getByRole('region', { name: screen.title, exact: true });
		const opener = card.getByRole('button', { name: /^(See all|All \d+)/ });
		await opener.click();
		const dialog = page.getByRole('dialog', { name: screen.title, exact: true });
		await expect(dialog).toBeVisible();
		const bounds = await dialog.boundingBox();
		expect(bounds?.width).toBeLessThanOrEqual(page.viewportSize()!.width);
		expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
			true
		);
		if (screen.id === 'projects' && (position[2] === 'default' || position[2] === 'busy'))
			await expect(dialog.getByText('Change history')).toBeVisible();
		await capture(page, position, screen.id);
		if (screen.id === 'quota' && (position[2] === 'default' || position[2] === 'busy')) {
			const history = dialog.locator('.hh-q-chart').first();
			await expect(history.locator('.hh-q-history-col > span').first()).toBeVisible();
			await expect(history.getByText('0%', { exact: true })).toBeVisible();
			await expect(history.getByText('Today', { exact: true })).toBeVisible();
		}
		await fullDialog(page, position, screen.id);
		if (screen.id === 'agents' && position[0] === 'phone' && position[2] === 'default')
			await agentChat(page, position, fixture);
		if (screen.id === 'wip') await workByProject(page, position);
		if (screen.id === 'quota' && position[2] === 'busy') {
			const stale = dialog.locator('.hh-q-plan').last();
			await expect(stale.getByText('Unknown', { exact: true })).toBeVisible();
			await expect(stale.getByRole('meter')).toHaveCount(0);
			await expect(dialog.getByText('Almost out', { exact: true }).first()).toBeVisible();
		}
		if (screen.id === 'quota' && position[2] === 'empty')
			await expect(dialog.getByText('Provider quota is unknown.')).toBeVisible();
		if (screen.id === 'scheduled' && position[2] === 'busy') {
			const routine = fixture.snapshot.scheduled.find((run) => run.source === 'claude')!;
			const tracker = fixture.snapshot.scheduled.find((run) => run.source === 'tracker')!;
			await expect(dialog.getByText('Claude routine dates are unknown.')).toBeVisible();
			await expect(dialog.getByText(routine.title, { exact: true })).toHaveCount(0);
			await expect(dialog.getByText(tracker.title, { exact: true })).toBeVisible();
		}
		await page.keyboard.press('Escape');
		await expect(opener).toBeFocused();
	}
}

async function agentChat(page: Page, position: CapturePosition, fixture: HomeFixture) {
	const dialog = page.getByRole('dialog', { name: 'Agents', exact: true });
	await dialog
		.getByRole('button', { name: /Chief of Staff/ })
		.first()
		.click();
	const chat = dialog.getByRole('region', { name: 'Chat with Chief of Staff' });
	await expect(chat.getByText('Yes, voicemail and carrier-busy passed.')).toBeVisible();
	await capture(page, position, 'agent-chat');
	await chat.getByRole('textbox', { name: 'Message', exact: true }).fill('Synthetic Tracker note');
	await chat.getByRole('button', { name: 'Send', exact: true }).click();
	await expect(chat.getByText('sent', { exact: true })).toBeVisible();
	expect(fixture.sent).toMatchObject([
		{ itemId: 'item-0', kind: 'note', text: 'Synthetic Tracker note' }
	]);
	await chat
		.getByRole('textbox', { name: 'Answer to open question' })
		.fill('Synthetic Tracker answer');
	await chat.getByRole('button', { name: 'Answer', exact: true }).click();
	expect(fixture.sent[1]).toMatchObject({
		itemId: 'item-0',
		kind: 'answer',
		question: 'Approve the Nudge production window, Sat 09:00?',
		text: 'Synthetic Tracker answer'
	});
	await dialog.getByRole('button', { name: 'Back to agents' }).click();
	await expect(chat).toBeHidden();
}

async function workByProject(page: Page, position: CapturePosition) {
	const dialog = page.getByRole('dialog', { name: 'Work in progress', exact: true });
	await dialog.getByRole('button', { name: 'By project' }).click();
	await capture(page, position, 'wip-projects');
	await fullDialog(page, position, 'wip-projects');
	if (position[2] === 'default' || position[2] === 'busy') {
		await expect(dialog.getByRole('heading', { name: 'iOS pairing', exact: true })).toHaveCount(0);
		const toggle = dialog.getByRole('button', { name: 'Show done' });
		await toggle.click();
		await expect(dialog.getByRole('heading', { name: 'iOS pairing', exact: true })).toBeVisible();
	}
}

async function fullDialog(page: Page, position: CapturePosition, screen: string) {
	const [id, scheme, state] = position;
	if (
		process.env.TAKE_SCREENSHOT !== 'true' ||
		state !== 'default' ||
		scheme !== 'dark' ||
		!['phone', 'laptop'].includes(id)
	)
		return;
	const viewport = page.viewportSize()!;
	const height = await page.getByRole('dialog').evaluate((element) => {
		const body = element.querySelector('.hh-dialog-body')!;
		const chrome = element.clientHeight - body.clientHeight;
		return body.scrollHeight + chrome;
	});
	await page.setViewportSize({
		width: viewport.width,
		height: Math.max(viewport.height, height + (id === 'phone' ? 0 : 84))
	});
	try {
		await capture(page, position, screen, true);
	} finally {
		await page.setViewportSize(viewport);
	}
}

async function fit(page: Page, width: number) {
	const bounds = await page.evaluate(() => ({
		width: document.documentElement.scrollWidth,
		columns: getComputedStyle(document.querySelector('.hh-grid')!).gridTemplateColumns.split(' ')
			.length
	}));
	expect(bounds.width).toBeLessThanOrEqual(width);
	expect(bounds.columns).toBe(width === 390 ? 1 : width === 834 ? 2 : width === 1440 ? 3 : 4);
}

async function capture(page: Page, position: CapturePosition, screen: string, full = false) {
	const [size, scheme, state] = position;
	const registryCapture = screen === 'root' && scheme === 'dark' && evidenceRequested();
	if (process.env.TAKE_SCREENSHOT !== 'true' && !registryCapture) return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(Array.from(document.images, (image) => image.decode()));
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
	});
	const options = { fullPage: screen === 'root', animations: 'disabled', caret: 'hide' } as const;
	if (registryCapture) {
		const stamp = await page.locator('meta[name="harness-build"]').getAttribute('content');
		const buildId = buildStamp(stamp ?? undefined);
		const revision = process.env.HARNESS_VERIFY_REVISION;
		if (!buildId || !revision) throw new Error('Hub home captures need the verified build stamp.');
		recordCapture(
			{
				evidence: 'home-screen',
				kind: 'screenshot',
				state,
				viewport: size,
				file: `hub-home-${state}-${size}.png`,
				mediaType: 'image/png',
				provenance: 'actual-capture',
				server: { buildId, revision }
			},
			await page.screenshot(options)
		);
	}
	if (process.env.TAKE_SCREENSHOT === 'true') {
		const directory = join(process.env.SCREENSHOT_DIR ?? '/tmp/harness-hub-home', size);
		mkdirSync(directory, { recursive: true });
		await page.screenshot({
			...options,
			path: join(directory, `${screen}--${state}--${scheme}${full ? '--full' : ''}.png`)
		});
	}
}
