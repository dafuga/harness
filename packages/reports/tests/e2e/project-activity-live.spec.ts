import { expect, test, type Page } from '@playwright/test';
import { activityPayload, manyAgents, type PayloadAgent } from './support/activityPayload';
import { fits, pictured, screens } from './support/sharedSelect';

/**
 * An open analytics page keeps reading who is working, shows a busy repository as a short first
 * view, and stops saying that anybody works once its reading is old. The readings are served
 * here in place of the server's answer, so nothing real is registered, changed or left behind.
 */
const api = '**/api/project-activity';
const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const list = (page: Page, name: string) => page.getByRole('list', { name, exact: true });
const shown = (page: Page, name: string) => list(page, name).locator('li:visible');
const refresh = (page: Page) => page.getByRole('button', { name: 'Refresh activity' });

/** Opens the page with its clock held, and answers every later reading from `answer`. */
async function opened(page: Page, answer: (at: number) => object | null) {
	const clock = { at: Date.now(), asked: 0 };
	await page.clock.install({ time: clock.at });
	await page.route(api, (route) => {
		clock.asked += 1;
		const body = answer(clock.at);
		return body ? route.fulfill({ json: body }) : route.fulfill({ status: 503, json: {} });
	});
	await page.goto('/harness/analytics');
	await expect(region(page, 'Working agents')).toBeVisible();
	const forward = async (seconds: number) => {
		clock.at += seconds * 1000;
		await page.clock.fastForward(seconds * 1000);
	};
	return { clock, forward };
}

for (const [screen, width, height] of screens) {
	test(`a busy repository is a short first view with its uncommitted work near the top at ${screen} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await opened(page, (at) => activityPayload(at));
		await refresh(page).click();
		await expect(region(page, 'Working agents').getByTestId('agents-working')).toHaveText('12');
		await pictured(page, `activity-busy-${screen}`);
		for (const [name, count] of [
			['Agent roster', 5],
			['Uncommitted files', 6],
			['Committed files', 6],
			['Recent commits', 5]
		] as const) {
			await expect(shown(page, name)).toHaveCount(count);
		}
		// What is not committed is near the top, and the whole of it is a few screens, not dozens.
		const open = (await list(page, 'Uncommitted files').boundingBox())!;
		const block = (await page.locator('.project-activity').boundingBox())!;
		expect(open.y).toBeLessThanOrEqual(2 * height);
		expect(block.height).toBeLessThanOrEqual(5 * height);
		await expect(region(page, 'Recently changed files')).toContainText(
			'44 files are not committed in 2 of 2 checkouts'
		);

		// Everything is one control away, and can be put away again.
		const more = region(page, 'Recent work').getByRole('button', { name: 'Show all 20 commits' });
		await expect(more).toHaveAttribute('aria-expanded', 'false');
		await more.click();
		await expect(shown(page, 'Recent commits')).toHaveCount(20);
		await region(page, 'Recent work').getByRole('button', { name: 'Show fewer commits' }).click();
		await expect(shown(page, 'Recent commits')).toHaveCount(5);
		await region(page, 'Recently changed files')
			.getByRole('button', { name: 'Show all 44 uncommitted files' })
			.click();
		await expect(shown(page, 'Uncommitted files')).toHaveCount(44);

		// A change of hundreds of components is a count until it is opened, then a dozen names.
		const large = shown(page, 'Recent commits').first();
		await expect(large).toContainText('549 components');
		await expect(large.locator('.pa-chip:visible')).toHaveCount(0);
		await large.locator('summary').click();
		await expect(large.locator('.pa-chip:visible')).toHaveCount(12);
		await expect(large).toContainText('537 more components are on its page');
		// Forty assignments of one agent are four names and a control for the rest.
		const busy = shown(page, 'Agent roster').first();
		await expect(busy.locator('.pa-chip:visible')).toHaveCount(4);
		await busy.locator('summary').click();
		await expect(busy.locator('.pa-chip:visible')).toHaveCount(40);
		expect(await fits(page)).toBe(true);
	});
}

test('an open page reads again by itself and on request, and says when it last read', async ({
	page
}) => {
	const agents: PayloadAgent[] = [{ label: 'Owner', state: 'working' }];
	const { clock, forward } = await opened(page, (at) => activityPayload(at, agents));
	const panel = region(page, 'Working agents');
	await refresh(page).click();
	await expect(panel.getByTestId('agents-working')).toHaveText('1');
	await expect(shown(page, 'Agent roster').first()).toContainText('Working');
	const read = (await panel.getByText(/Live · read/).innerText()).trim();
	// The owner's process ends; nobody presses anything.
	agents[0] = { label: 'Owner', state: 'gone', detail: 'Its process 4242 ended' };
	const before = clock.asked;
	await forward(16);
	await expect(panel.getByTestId('agents-working')).toHaveText('0');
	await expect(shown(page, 'Agent roster').first()).toContainText('Process ended');
	expect(clock.asked).toBeGreaterThan(before);
	expect((await panel.getByText(/Live · read/).innerText()).trim()).not.toBe(read);
});

test('when readings stop arriving, nobody is described as working any longer', async ({ page }) => {
	let answering = true;
	const agents: PayloadAgent[] = [{ label: 'Owner', state: 'working' }];
	const { forward } = await opened(page, (at) => (answering ? activityPayload(at, agents) : null));
	const panel = region(page, 'Working agents');
	await refresh(page).click();
	await expect(panel.getByTestId('agents-working')).toHaveText('1');
	answering = false;
	await refresh(page).click();
	await expect(panel.getByRole('status')).toContainText('could not be read again');
	// The last reading still stands for a moment, and is marked as the last one that arrived.
	await expect(panel.getByTestId('agents-working')).toHaveText('1');
	await forward(70);
	await pictured(page, 'activity-not-confirmed');
	await expect(panel.getByTestId('agents-working')).toHaveText('Unknown');
	await expect(shown(page, 'Agent roster').first()).toContainText('Not confirmed');
	await expect(shown(page, 'Agent roster').first()).not.toContainText('Working');
	// A reading that arrives again is believed again.
	answering = true;
	await refresh(page).click();
	await expect(panel.getByTestId('agents-working')).toHaveText('1');
	await expect(panel.getByRole('status')).toHaveCount(0);
});

test('the CPU panel says which figures are the machine and which are this repository', async ({
	page
}) => {
	const group = (id: string, label: string) => ({
		...{ id, label, corePercent: 40, machinePercent: 5, processes: 3 }
	});
	await page.route('**/api/analytics-cpu', (route) =>
		route.fulfill({
			json: {
				...{ status: 'available', sampledAt: new Date().toISOString(), intervalMs: 1000 },
				...{ logicalCores: 8, machinePercent: 25, trackedPercent: 12, agents: [] },
				groups: [
					group('codex', 'Codex app'),
					group('harness', 'Harness'),
					group('agents', 'Local agents')
				]
			}
		})
	);
	await page.goto('/harness/analytics');
	for (const id of ['cpu-codex', 'cpu-harness']) {
		await expect(page.getByTestId(id)).toContainText('All projects on this machine');
	}
	await expect(page.getByTestId('cpu-agents')).toContainText('This repository');
	await expect(page.getByTestId('cpu-tracked')).toContainText('not a figure of this repository');
});
