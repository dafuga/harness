import { expect, test, type Page } from '../../../../test/support/browserTest';
import type {
	HomeAgent,
	HomeMessage,
	OwnerHomeSnapshot
} from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import { hubHomeFixture } from './hub-home-fixture';
import { linkedComputersFixture } from './linked-computers-fixture';

/**
 * Hub messages with the Home upload off: they go to a linked Mac over its encrypted connection,
 * and each one shows whether the Tracker stored it, the session received it, and its reply.
 * TAKE_SCREENSHOT=true keeps the pictures in SCREENSHOT_DIR.
 */
test.setTimeout(60000);

const sizes = {
	desktop: { width: 1440, height: 900 },
	tablet: { width: 820, height: 1180 },
	phone: { width: 390, height: 844 }
};

async function shot(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = process.env.SCREENSHOT_DIR ?? 'test-results/hub-messages';
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(Array.from(document.images, (image) => image.decode()));
	});
	await page.screenshot({
		path: `${directory}/${process.env.SCREENSHOT_LABEL ?? 'current'}-${name}.png`,
		animations: 'disabled'
	});
}

async function linkedHome(page: Page, size: keyof typeof sizes) {
	await page.setViewportSize(sizes[size]);
	await page.emulateMedia({
		colorScheme: size === 'tablet' ? 'light' : 'dark',
		reducedMotion: 'reduce'
	});
	const fixture = await hubHomeFixture(page, 'default');
	// Nothing is uploaded to the Hub: Home comes only from the linked Mac.
	await page.route('**/api/hub-home', (route) =>
		route.fulfill({ json: { granted: false, snapshot: null, controlled: ['harbor'] } })
	);
	const snapshot: OwnerHomeSnapshot = structuredClone(fixture.snapshot);
	const chief = snapshot.agents.find((agent) => agent.id === 'cos')!;
	chief.messages = [];
	const harbor: HomeAgent = {
		...chief,
		id: 'harbor',
		name: 'harbor',
		state: 'working',
		itemId: 'harborwork',
		runId: 'mb2#104',
		question: null,
		options: undefined,
		confirm: undefined,
		messages: []
	};
	snapshot.agents = snapshot.agents.map((agent) => (agent.id === harbor.id ? harbor : agent));
	snapshot.openAsks = snapshot.openAsks?.filter((ask) => ask.agentId !== harbor.id);
	const chats: { id: string }[] = [];
	await linkedComputersFixture(
		page,
		() => snapshot,
		chats,
		(input: { id: string }) => ({
			id: input.id,
			status: 'sent',
			messageId: 'chatcos234-1a2b3c4d'
		})
	);
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	return { fixture, chief, harbor, chats, snapshot };
}

const mine = (text: string, status: HomeMessage['status'], reason?: string): HomeMessage => ({
	id: 'hub-chatcos234-1a2b3c4d',
	messageId: 'chatcos234-1a2b3c4d',
	from: 'you',
	text,
	at: new Date().toISOString(),
	status,
	...(reason && { reason })
});

for (const size of ['desktop', 'tablet', 'phone'] as const) {
	test(`Home's chat box reaches Chief of Staff and shows delivery and the reply (${size})`, async ({
		page
	}) => {
		const { fixture, chief, chats } = await linkedHome(page, size);
		await shot(page, `hub-cos-home-${size}`);
		await expect(page.getByRole('textbox', { name: 'Message Chief of Staff' })).toHaveCount(0);
		const launch = page.getByRole('region', { name: 'Chief of Staff', exact: true });
		const opener = launch.getByRole('button', { name: 'Open chat', exact: true });
		await expect(launch.getByRole('button')).toHaveCount(1);
		await opener.click();
		const box = page.getByRole('dialog', { name: 'Chief of Staff', exact: true });
		await expect(box).toBeVisible();
		const bounds = (await box.boundingBox())!;
		const { width, height } = sizes[size];
		if (size === 'phone') expect(bounds).toEqual({ x: 0, y: 0, width, height });
		else {
			expect(bounds.x).toBeGreaterThan(width - bounds.x - bounds.width);
			expect(width - (bounds.x + bounds.width)).toBeLessThanOrEqual(24);
			expect(height - (bounds.y + bounds.height)).toBeLessThanOrEqual(24);
		}
		await box.getByRole('textbox', { name: 'Message Chief of Staff' }).fill('Saved draft');
		await page.keyboard.press('Escape');
		await expect(box).toHaveCount(0);
		await expect(opener).toBeFocused();
		await opener.click();
		await expect(box.getByRole('textbox', { name: 'Message Chief of Staff' })).toHaveValue(
			'Saved draft'
		);
		await box.getByRole('textbox', { name: 'Message Chief of Staff' }).fill('Ship the hub release');
		await box.getByRole('button', { name: 'Send' }).click();
		await expect.poll(() => chats.length).toBe(1);
		expect(chats[0]).toMatchObject({
			kind: 'message',
			agentId: 'cos',
			itemId: 'cos',
			question: null,
			text: 'Ship the hub release'
		});
		expect(chats[0]).not.toHaveProperty('runId');
		const sent = box.getByRole('listitem').filter({ hasText: 'Ship the hub release' });
		await expect(sent).toContainText('Stored in Tracker');

		// Chief of Staff is reached through its Tracker channel; a busy channel says so.
		const busy = 'Chief of Staff channel: Digest session is not idle';
		chief.messages = [mine('Ship the hub release', 'stored', busy)];
		await expect(sent).toContainText(`Not delivered yet: ${busy}`, { timeout: 15_000 });
		await box.scrollIntoViewIfNeeded();
		await shot(page, `hub-cos-chat-waiting-${size}`);
		chief.messages = [mine('Ship the hub release', 'delivered')];
		await expect(sent).toContainText('Delivered to Chief of Staff', { timeout: 15_000 });
		chief.messages = [
			mine('Ship the hub release', 'acknowledged'),
			{
				id: 'reply-1',
				from: 'agent',
				text: 'Shipping it now.',
				at: new Date().toISOString(),
				replyTo: 'chatcos234-1a2b3c4d'
			}
		];
		await expect(box.getByRole('listitem').filter({ hasText: 'Shipping it now.' })).toBeVisible({
			timeout: 15_000
		});
		await expect(sent).toContainText('Replied');
		// The newest entries are never hidden inside a scrolled box.
		const thread = box.getByRole('list', { name: 'Chief of Staff conversation' });
		expect(await thread.evaluate((list) => list.scrollHeight - list.clientHeight)).toBeLessThan(2);
		await expect(box.getByRole('listitem').filter({ hasText: 'Ship the hub release' })).toHaveCount(
			1
		);
		// The Hub never sees the message: nothing is queued there.
		expect(fixture.sent).toHaveLength(0);
		const widths = await page.evaluate(() => [
			document.documentElement.scrollWidth,
			window.innerWidth
		]);
		expect(widths[0]).toBeLessThanOrEqual(widths[1]);
		await shot(page, `hub-cos-chat-${size}`);
	});
}

test("a session's Message button sends to that session's live run, and shows a refusal", async ({
	page
}) => {
	const { harbor, chats } = await linkedHome(page, 'desktop');
	await page.getByRole('button', { name: 'Message harbor' }).click();
	const chat = page.getByRole('region', { name: 'Chat with harbor' });
	await chat.getByRole('textbox', { name: 'Message' }).fill('Rebase first');
	await chat.getByRole('button', { name: 'Send' }).click();
	await expect.poll(() => chats.length).toBe(1);
	expect(chats[0]).toMatchObject({
		kind: 'message',
		agentId: 'harbor',
		itemId: 'harborwork',
		runId: 'mb2#104',
		text: 'Rebase first'
	});
	harbor.messages = [mine('Rebase first', 'refused', 'run mb2#104 ended')];
	await expect(chat.getByRole('listitem').filter({ hasText: 'Rebase first' })).toContainText(
		'Not delivered: run mb2#104 ended',
		{ timeout: 15_000 }
	);
	await shot(page, 'hub-session-message-refused');
});

test('refresh removes a resolved ask from the open widget even if an agent retains old text', async ({
	page
}) => {
	await page.clock.install();
	const { chief, snapshot } = await linkedHome(page, 'desktop');
	const needs = page.getByRole('region', { name: 'Blocked - needs you' });
	await needs.getByRole('button', { name: 'Talk to Chief of Staff', exact: true }).first().click();
	const widget = page.getByRole('dialog', { name: 'Chief of Staff', exact: true });
	await expect(widget.getByText(chief.question!, { exact: false })).toBeVisible();
	snapshot.openAsks = [];
	await page.clock.runFor(21_000);
	await expect(widget.getByText('This question is no longer open.')).toBeVisible();
	await expect(widget.getByText(chief.question!, { exact: false })).toHaveCount(0);
	await expect(widget.getByRole('group', { name: 'Choose an answer' })).toHaveCount(0);
});
