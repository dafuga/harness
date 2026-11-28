import type { Page } from '@playwright/test';
import { expect, test } from '../../../../test/support/browserTest';
import type {
	HomeAgent,
	HomeOpenAsk,
	OwnerHomeSnapshot
} from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import { hubHomeFixture } from './hub-home-fixture';
import { homeClock } from './hub-home-fixture-data';

test.setTimeout(60_000);

const ago = (minutes: number) => new Date(homeClock - minutes * 60_000).toISOString();
const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

function agent(id: string, task: string, more: Partial<HomeAgent> = {}): HomeAgent {
	return {
		id,
		name: id,
		state: 'idle',
		sessions: 0,
		tasks: [],
		subAgents: { sessions: 0, tasks: [] },
		itemId: `item-${id}`,
		task,
		machine: 'Primary Mac',
		model: null,
		since: ago(30),
		question: null,
		messages: [],
		...more
	};
}

function ask(id: string, minutes: number, question: string): HomeOpenAsk {
	return {
		itemId: `item-${id}`,
		agentId: id,
		agentName: id,
		title: question,
		question,
		options: [
			{ label: 'Grid of all screens', effect: 'Every screen at a glance.', recommended: true },
			{ label: 'Last screen viewed', effect: 'Pick up where you left off.' },
			{ label: 'First screen, full size', effect: 'Largest view of one screen.' }
		],
		since: ago(minutes)
	};
}

/** Made-up agents: three ask, two work. */
function dockData(snapshot: OwnerHomeSnapshot) {
	const note = {
		id: 'note-1',
		from: 'agent' as const,
		at: ago(140),
		text: 'The viewer is built and its checks pass. One choice is left before I open the pull request.'
	};
	snapshot.agents = [
		agent('cos', 'Watching the sessions', {
			name: 'Chief of Staff',
			state: 'working',
			sessions: 1,
			subAgents: { sessions: 6, tasks: [] }
		}),
		agent('Harness Coder', 'Design canvas viewer', { state: 'needs-you', messages: [note] }),
		agent('Notes Coder', 'Notification service build', { state: 'needs-you' }),
		agent('Shop Tester', 'Live checkout tests', { state: 'needs-you' })
	];
	snapshot.openAsks = [
		ask('Harness Coder', 134, 'Which layout should the design canvas open with?'),
		ask('Notes Coder', 46, 'Approve the spec before the build starts?'),
		ask('Shop Tester', 12, 'Spend up to $5 on live tests today?')
	];
}

async function dockHome(page: Page, size: keyof typeof sizes, scheme: 'light' | 'dark') {
	await page.setViewportSize(sizes[size]);
	await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
	const fixture = await hubHomeFixture(page, 'default');
	dockData(fixture.snapshot);
	await page.goto('/');
	return fixture;
}

const launcher = (page: Page) => page.getByRole('button', { name: 'Agents, 3 have questions' });
const panel = (page: Page) => page.locator('dialog.hd-panel');

/** The viewport, so a fixed dock is drawn where the reader sees it. */
async function shot(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${name}.png` });
}

/** How light the closed dock is painted, from 0 (black) to 1 (white). */
async function lightness(page: Page) {
	return page.locator('.hd-launch').evaluate((element) => {
		const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
		canvas.fillStyle = getComputedStyle(element).backgroundColor;
		canvas.fillRect(0, 0, 1, 1);
		const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data;
		return (r + g + b) / 3 / 255;
	});
}

async function fits(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

for (const size of ['desktop', 'phone'] as const)
	for (const scheme of ['light', 'dark'] as const) {
		test(`agents dock lists, chats and answers (${size}, ${scheme})`, async ({ page }) => {
			const fixture = await dockHome(page, size, scheme);
			await expect(launcher(page)).toBeVisible();
			// Home follows the visitor's scheme, so the dock on it does too.
			expect(await lightness(page)).toBeGreaterThan(scheme === 'light' ? 0.8 : 0);
			if (scheme === 'dark') expect(await lightness(page)).toBeLessThan(0.3);
			await shot(page, `dock-closed-${size}-${scheme}`);
			await launcher(page).click();
			const dock = panel(page);
			await expect(dock.getByText('3 have questions · 1 working')).toBeVisible();
			const rows = dock.locator('.hd-row');
			await expect(rows).toHaveText([
				/Harness Coder.*waiting 2h 14m.*Which layout/s,
				/Notes Coder.*waiting 46m/s,
				/Shop Tester.*waiting 12m/s,
				/Chief of Staff.*Watching 6 sessions.*Working/s
			]);
			await expect(page.locator('dialog.hd-panel:modal')).toHaveCount(size === 'phone' ? 1 : 0);
			const box = (await dock.boundingBox())!;
			if (size === 'phone') expect(box).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
			else expect([box.width, box.x + box.width, box.y + box.height]).toEqual([392, 1408, 884]);
			await fits(page);
			await shot(page, `dock-open-${size}-${scheme}`);

			await rows.first().click();
			await expect(dock.getByText('Question · waiting 2h 14m')).toBeVisible();
			await expect(dock.getByText('The viewer is built', { exact: false })).toBeVisible();
			await expect(dock.getByRole('textbox')).toHaveCount(1);
			const choices = dock.getByRole('group', { name: 'Choose an answer' }).getByRole('button');
			await expect(choices).toHaveText([
				/Grid of all screens/,
				/Last screen/,
				/First screen/,
				/Other/
			]);
			const [first, second] = [
				await choices.nth(0).boundingBox(),
				await choices.nth(1).boundingBox()
			];
			if (size === 'phone') expect(second!.y).toBeGreaterThan(first!.y);
			else expect(second!.y).toBe(first!.y);
			await fits(page);
			await shot(page, `dock-chat-${size}-${scheme}`);

			await choices.first().click();
			await expect.poll(() => fixture.sent.length).toBe(1);
			expect(fixture.sent[0]).toMatchObject({
				agentId: 'Harness Coder',
				itemId: 'item-Harness Coder',
				kind: 'answer',
				question: 'Which layout should the design canvas open with?',
				text: 'Grid of all screens',
				option: 1
			});
			await expect(dock.getByText(/Answer (queued|sent) · Grid of all screens/)).toBeVisible();
			await dock.getByRole('textbox', { name: 'Message Harness Coder' }).fill('Thanks');
			await dock.getByRole('button', { name: 'Send', exact: true }).click();
			await expect.poll(() => fixture.sent.length).toBe(2);
			expect(fixture.sent[1]).toMatchObject({ kind: 'note', text: 'Thanks' });

			await dock.getByRole('button', { name: 'Back to agents' }).click();
			await dock.getByRole('button', { name: 'New conversation' }).click();
			await expect(dock.getByRole('heading', { name: 'New conversation' })).toBeVisible();
			await dock.getByRole('button', { name: /Chief of Staff/ }).click();
			await expect(dock.getByRole('textbox', { name: 'Message Chief of Staff' })).toBeVisible();
			await page.keyboard.press('Escape');
			await expect(dock).toHaveCount(0);
			await expect(page.getByRole('button', { name: /^Agents,/ })).toBeFocused();
		});

		test(`agents dock follows to another page (${size}, ${scheme})`, async ({ page }) => {
			await dockHome(page, size, scheme);
			await expect(launcher(page)).toBeVisible();
			await page.goto('/projects');
			await expect(launcher(page)).toBeVisible();
			await fits(page);
			await shot(page, `dock-projects-${size}-${scheme}`);
			// The band under the page keeps the pill off its last row.
			await page.mouse.wheel(0, 4000);
			await expect(page.locator('.hd-band')).toBeVisible();
			await launcher(page).click();
			await expect(panel(page).locator('.hd-row')).toHaveCount(4);
			await shot(page, `dock-projects-open-${size}-${scheme}`);
		});
	}
