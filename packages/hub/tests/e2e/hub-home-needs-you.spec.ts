import { expect, test, type Page } from '../../../../test/support/browserTest';
import { hubHomeFixture } from './hub-home-fixture';
import { linkedComputersFixture } from './linked-computers-fixture';

/**
 * "Needs you" on Home: each row carries its choices (recommended first) and Other, and opens the
 * asking session's chat, which offers the same. TAKE_SCREENSHOT=true keeps the pictures in
 * SCREENSHOT_DIR.
 */
test.setTimeout(60000);

const sizes = {
	desktop: { width: 1440, height: 900 },
	tablet: { width: 820, height: 1180 },
	phone: { width: 390, height: 844 }
};

async function shot(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = process.env.SCREENSHOT_DIR ?? 'test-results/needs-you';
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(Array.from(document.images, (image) => image.decode()));
	});
	await page.screenshot({
		path: `${directory}/${process.env.SCREENSHOT_LABEL ?? 'current'}-${name}.png`,
		animations: 'disabled'
	});
}

async function home(page: Page, size: keyof typeof sizes, change: 'two-asks' | 'no-choices') {
	await page.setViewportSize(sizes[size]);
	await page.emulateMedia({
		colorScheme: size === 'tablet' ? 'light' : 'dark',
		reducedMotion: 'reduce'
	});
	const fixture = await hubHomeFixture(page, 'default');
	const [chief] = fixture.snapshot.agents;
	if (change === 'two-asks')
		fixture.snapshot.agents.push({
			...chief,
			id: 'harbor',
			name: 'harbor',
			itemId: 'item-harbor',
			question: 'Ship harbor?',
			confirm: undefined,
			messages: [],
			options: [
				{ label: 'Ship harbor now', effect: 'Merges and releases.', recommended: true },
				{ label: 'Hold harbor', effect: 'Waits a day.' }
			]
		});
	else
		for (const agent of fixture.snapshot.agents) {
			delete agent.options;
			delete agent.confirm;
		}
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Agents', exact: true })).toBeVisible();
	return fixture;
}

const needsYou = (page: Page) => page.getByRole('region', { name: /^Blocked - needs you/ });
/** The part of a row that opens the asking session's chat. */
const openers = (page: Page) => needsYou(page).getByRole('button', { name: /waiting \d+[mhd]/ });
const rowOf = (page: Page, project: string) =>
	needsYou(page).getByRole('listitem').filter({ hasText: project });
const agentsCard = (page: Page) => page.getByRole('region', { name: 'Agents', exact: true });

for (const size of ['desktop', 'tablet', 'phone'] as const) {
	test(`Home rows offer their choices and open the session chat (${size})`, async ({ page }) => {
		const fixture = await home(page, size, 'two-asks');
		const rows = openers(page);
		await expect(rows).toHaveCount(2);
		// The count lives with the items in the blockers section; Agents shows only agents.
		await expect(needsYou(page).getByText('2 need you', { exact: true })).toBeVisible();
		await expect(agentsCard(page)).toBeVisible();
		await expect(agentsCard(page).getByText(/\d+ needs? you/)).toHaveCount(0);
		await expect(rows.filter({ hasText: 'harbor' })).toContainText(
			/Ship harbor\?.*waiting \d+[mhd]/s
		);
		// Every row has its buttons: the recommended choice first, Other last, no inline field.
		await expect(needsYou(page).getByRole('group', { name: 'Choose an answer' })).toHaveCount(2);
		const choices = rowOf(page, 'harbor')
			.getByRole('group', { name: 'Choose an answer' })
			.getByRole('button');
		await expect(choices).toHaveText([/Ship harbor now.*Recommended/s, /Hold harbor/, /Other/]);
		await expect(needsYou(page).getByRole('textbox')).toHaveCount(0);
		const widths = await page.evaluate(() => [
			document.documentElement.scrollWidth,
			window.innerWidth
		]);
		expect(widths[0]).toBeLessThanOrEqual(widths[1]);
		await shot(page, `hub-home-needs-you-${size}`);
		await expect(rowOf(page, 'harbor').getByText('Merges and releases.')).toHaveCount(0);
		await expect(rowOf(page, 'harbor').getByText('Waits a day.')).toHaveCount(0);

		await rows.filter({ hasText: 'harbor' }).click();
		const chat = page.getByRole('region', { name: 'Chat with harbor' });
		const latest = chat
			.getByRole('list', { name: 'Tracker conversation' })
			.getByRole('listitem')
			.last();
		await expect(latest.getByText('Ship harbor?')).toBeVisible();
		await expect(latest.getByText('Merges and releases.')).toBeVisible();
		await expect(
			latest.getByRole('button', { name: /Ship harbor now.*Recommended/s })
		).toBeVisible();
		await expect(latest.getByRole('button', { name: /Other/ })).toBeVisible();
		await expect(chat.getByRole('textbox', { name: /answer|reply/i })).toHaveCount(0);
		await shot(page, `hub-chat-ask-${size}`);

		await latest.getByRole('button', { name: /Other/ }).click();
		const modal = page.getByRole('dialog', { name: 'Other answer' });
		const field = modal.getByRole('textbox', { name: 'Your answer' });
		await expect(field).toBeFocused();
		await expect(modal.getByRole('button', { name: 'Send answer' })).toBeDisabled();
		await field.fill('Ship it Friday,\nafter the freeze.');
		await shot(page, `hub-other-modal-${size}`);
		// Escape closes only the modal; the chat stays open.
		await page.keyboard.press('Escape');
		await expect(modal).toBeHidden();
		await expect(chat).toBeVisible();
		expect(fixture.sent).toHaveLength(0);

		await latest.getByRole('button', { name: /Other/ }).click();
		await field.fill('Ship it Friday,\nafter the freeze.');
		await modal.getByRole('button', { name: 'Send answer' }).click();
		await expect.poll(() => fixture.sent.length).toBe(1);
		expect(fixture.sent[0]).toMatchObject({
			agentId: 'harbor',
			itemId: 'item-harbor',
			kind: 'answer',
			question: 'Ship harbor?',
			text: 'Ship it Friday,\nafter the freeze.'
		});
		expect(fixture.sent[0]).not.toHaveProperty('option');
	});
}

test('a tapped choice in the chat is sent as that option', async ({ page }) => {
	const fixture = await home(page, 'desktop', 'two-asks');
	await openers(page).filter({ hasText: 'harbor' }).click();
	await page
		.getByRole('region', { name: 'Chat with harbor' })
		.getByRole('button', { name: /Hold harbor/ })
		.click();
	await expect.poll(() => fixture.sent.length).toBe(1);
	expect(fixture.sent[0]).toMatchObject({ agentId: 'harbor', kind: 'answer', option: 2 });
});

for (const size of ['desktop', 'phone'] as const)
	test(`a choice tapped on a row answers that ask without opening the chat (${size})`, async ({
		page
	}) => {
		const fixture = await home(page, size, 'two-asks');
		const row = rowOf(page, 'harbor');
		const choice = row.getByRole('button', { name: /Hold harbor/ });
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await choice.scrollIntoViewIfNeeded();
		await page.evaluate(() => document.fonts.ready.then(() => {}));
		const record = process.env.TAKE_SCREENSHOT === 'true';
		if (record)
			await page.screencast.start({
				path: test.info().outputPath(`answer-${size}.webm`),
				size: sizes[size]
			});
		try {
			await choice.click();
			await expect(row.getByRole('status')).toContainText(/Answer sent.*Hold harbor/);
			await shot(page, `answer-confirmed-${size}`);
			await expect(row).toHaveCount(0);
		} finally {
			if (record) await page.screencast.stop();
		}
		await expect.poll(() => fixture.sent.length).toBe(1);
		expect(fixture.sent[0]).toMatchObject({
			itemId: 'item-harbor',
			kind: 'answer',
			question: 'Ship harbor?',
			text: 'Hold harbor',
			option: 2
		});
		await expect(page.getByRole('dialog')).toHaveCount(0);
		const deploy = rowOf(page, 'Chief of Staff');
		await deploy.getByRole('button', { name: /Approve Saturday/ }).click();
		const confirmation = page.getByRole('dialog', { name: 'Confirm answer' });
		await expect(confirmation.getByText('Approve Saturday 09:00', { exact: true })).toBeVisible();
		await expect(deploy.getByRole('group', { name: /Confirm this deploy answer/ })).toHaveCount(0);
		await shot(page, 'hub-home-confirm-phone');
		await page.keyboard.press('Escape');
		await expect(confirmation).toHaveCount(0);
		await expect(deploy.getByRole('button', { name: /Approve Saturday/ })).toBeFocused();
		const other = deploy.getByRole('button', { name: 'Other…', exact: true });
		await other.click();
		const answer = page.getByRole('dialog', { name: 'Other answer' });
		await expect(answer.getByRole('textbox', { name: 'Your answer' })).toBeFocused();
		await expect(deploy.locator('input, textarea, select, form')).toHaveCount(0);
		await shot(page, 'hub-home-other-phone');
		await page.keyboard.press('Escape');
		await expect(answer).toHaveCount(0);
		await expect(other).toBeFocused();
		expect(fixture.sent).toHaveLength(1);
		await expect(row).toHaveCount(0);
	});

test('with nothing stored on the Hub, a row tap goes to the linked Mac over its connection', async ({
	page
}) => {
	await page.setViewportSize(sizes.desktop);
	const fixture = await hubHomeFixture(page, 'default');
	await page.route('**/api/hub-home', (route) =>
		route.fulfill({ json: { granted: false, snapshot: null } })
	);
	const asked = fixture.snapshot.agents.find((agent) => agent.options);
	if (!asked?.options) throw new Error('Expected a fixture ask with choices');
	delete asked.confirm;
	const chats: unknown[] = [];
	await linkedComputersFixture(page, fixture.snapshot, chats);
	await page.goto('/');
	await needsYou(page)
		.getByRole('button', { name: new RegExp(asked.options[1].label) })
		.click();
	await expect.poll(() => chats.length).toBe(1);
	expect(chats[0]).toMatchObject({ itemId: asked.itemId, kind: 'answer', option: 2 });
	await expect(needsYou(page).getByRole('status')).toContainText('Answer sent');
	// The Hub never sees the answer: nothing is queued there.
	expect(fixture.sent).toHaveLength(0);
});

test('a flag without choices is not counted, listed or answerable', async ({ page }) => {
	await home(page, 'desktop', 'no-choices');
	await expect(needsYou(page)).toHaveCount(0);
	await expect(page.getByText(/\d+ needs? you/)).toHaveCount(0);
	await expect(page.getByRole('heading', { level: 1 })).not.toContainText('you');
});
