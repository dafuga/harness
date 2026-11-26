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

const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

async function shot(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = process.env.SCREENSHOT_DIR ?? 'test-results/hub-messages';
	await page.screenshot({ path: `${directory}/${name}.png`, animations: 'disabled' });
}

async function linkedHome(page: Page, size: keyof typeof sizes) {
	await page.setViewportSize(sizes[size]);
	await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
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
	snapshot.agents.push(harbor);
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
	return { fixture, chief, harbor, chats };
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

for (const size of ['desktop', 'phone'] as const) {
	test(`Home's chat box reaches Chief of Staff and shows delivery and the reply (${size})`, async ({
		page
	}) => {
		const { fixture, chief, chats } = await linkedHome(page, size);
		const box = page.getByRole('region', { name: 'Message Chief of Staff' });
		await expect(box).toBeVisible();
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
