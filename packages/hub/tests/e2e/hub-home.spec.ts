import { expect, test, type Locator, type Page } from '../../../../test/support/browserTest';
import { fit, hubHomeFixture, unavailableHome } from './hub-home-fixture';
import type { CapturePosition, HomeFixture } from './hub-home-fixture.types';
import { capture, fullDialog } from './hub-home-capture';
import { planClickThrough, scheduledClickThrough } from './hub-home-click-through';
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
		for (const mode of ['default', 'busy', 'empty', 'loading', 'unavailable'] as const) {
			test(`Hub home ${viewport.id} ${scheme} ${mode}`, async ({
				page,
				baseURL,
				browserErrors
			}) => {
				await page.setViewportSize({ width: viewport.width, height: viewport.height });
				await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
				const fixture = await hubHomeFixture(page, mode);
				const path = [viewport.id, scheme, mode] as const;
				if (mode === 'unavailable')
					return unavailableHome({ page, baseURL, browserErrors }, fixture, (screen) =>
						capture(page, path, screen)
					);
				await page.goto('/');
				await expect(page).toHaveTitle('Harness · Home');
				await expect(page.getByRole('heading', { level: 1 })).toHaveText(
					mode === 'loading'
						? 'Loading your home…'
						: mode === 'empty'
							? 'Nothing is running yet'
							: /running.*, .* need[s]? you/
				);
				if (mode === 'default' || mode === 'busy') {
					await expect(page.locator('.hh-projects .hh-change').first()).toBeVisible();
					const agents = page.getByRole('region', { name: 'Agents', exact: true });
					await expect(agents.locator('.hh-agent-list > *')).toHaveCount(1);
					await expect(agents.locator('.hh-agent-list')).toContainText('Chief of Staff');
					await expect(agents.locator('.hh-agent-list')).toContainText('sub-agent session');
				}
				await fit(page, viewport.width);
				await capture(page, path, 'root');
				const fullMatrix =
					mode === 'default' || (scheme === 'dark' && ['phone', 'laptop'].includes(viewport.id));
				if (fullMatrix) await dialogs(page, path, fixture);
				if (mode === 'default') {
					await planClickThrough(page, path, fixture);
					await scheduledClickThrough(page, path, fixture);
				}
				if (mode === 'loading') {
					fixture.release();
					await expect(page.getByRole('heading', { level: 1 })).toHaveText(
						/running.*, .* need[s]? you/
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
			await expect(dialog.getByText('Connect subscriptions in the Harness Mac app.')).toBeVisible();
		if (screen.id === 'scheduled' && position[2] === 'busy') {
			const routine = fixture.snapshot.scheduled.find((run) => run.source === 'claude')!;
			const tracker = fixture.snapshot.scheduled.find((run) => run.source === 'tracker')!;
			await expect(dialog.getByText(/routine dates are unknown/)).toHaveCount(0);
			await expect(dialog.getByText(routine.title, { exact: true })).toHaveCount(0);
			await expect(dialog.getByText(tracker.title, { exact: true })).toBeVisible();
		}
		await page.keyboard.press('Escape');
		await expect(opener).toBeFocused();
	}
}

async function agentChat(page: Page, position: CapturePosition, fixture: HomeFixture) {
	const dialog = page.getByRole('dialog'); // titled by the agent once the phone chat opens
	if (fixture.snapshot.overview.status === 'ready')
		await expect(dialog.getByText(/live sessions? across Tracker/)).toContainText(
			String(fixture.snapshot.overview.liveSessions)
		);
	await dialog
		.getByRole('button', { name: /Chief of Staff/ })
		.first()
		.click();
	const chat = dialog.getByRole('region', { name: 'Chat with Chief of Staff' });
	await expect(chat.getByText('Yes, voicemail and carrier-busy passed.')).toBeVisible();
	await capture(page, position, 'agent-chat');
	const opener = chat.getByRole('button', { name: 'Open chat', exact: true });
	await opener.click();
	const widget = page
		.getByRole('dialog', { name: 'Chief of Staff', exact: true })
		.filter({ has: page.getByRole('textbox', { name: 'Message Chief of Staff' }) });
	await widget
		.getByRole('textbox', { name: 'Message Chief of Staff' })
		.fill('Synthetic Hub message');
	await widget.getByRole('button', { name: 'Send', exact: true }).click();
	await expect(widget.getByRole('status')).toHaveText('Queued for Tracker');
	await page.keyboard.press('Escape');
	await expect(opener).toBeFocused();
	// Chief of Staff messages go to the Tracker channel.
	expect(fixture.sent).toMatchObject([
		{ agentId: 'cos', itemId: 'cos', kind: 'message', text: 'Synthetic Hub message' }
	]);
	await dialog.getByRole('button', { name: 'Back to agents' }).click();
	await expect(chat).toBeHidden();
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Talk to Chief of Staff', exact: true }).first().click();
	await optionTap(widget, fixture);
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'See all agents' }).click();
}

/** Option buttons list the recommended choice first; a deploy ask needs its confirm step. */
async function optionTap(chat: Locator, fixture: HomeFixture) {
	const choices = chat.getByRole('group', { name: 'Choose an answer' });
	const buttons = choices.getByRole('button');
	// The two choices, then Other.
	await expect(buttons).toHaveCount(3);
	await expect(buttons.last()).toContainText('Other');
	await expect(buttons.first()).toContainText('Approve Saturday 09:00');
	await expect(buttons.first()).toContainText('Recommended');
	await buttons.first().click();
	const confirm = chat.getByRole('group', { name: 'Confirm this deploy answer' });
	await expect(confirm).toBeVisible();
	expect(fixture.sent).toHaveLength(1);
	await confirm.getByRole('button', { name: 'Cancel' }).click();
	await expect(confirm).toBeHidden();
	await buttons.first().click();
	await confirm.getByRole('button', { name: 'Confirm answer' }).click();
	await expect(
		chat.getByRole('status').filter({ hasText: /^Chief of Staff: Answer/ })
	).toBeVisible();
	await expect(confirm).toBeHidden();
	expect(fixture.sent[1]).toMatchObject({
		itemId: 'item-0',
		kind: 'answer',
		text: 'Approve Saturday 09:00',
		option: 1,
		confirmed: true
	});
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
		const completed = dialog.getByRole('article', { name: 'iOS pairing', exact: true });
		await expect(completed).toBeVisible();
		await capture(page, position, 'wip-projects-show-done');
		await expect(completed.locator('.po-counts')).toHaveText('Nothing open');
	}
}
