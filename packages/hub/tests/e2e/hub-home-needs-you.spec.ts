import { expect, test, type Page } from '../../../../test/support/browserTest';
import { hubHomeFixture } from './hub-home-fixture';

/**
 * "Needs you" on Home: compact rows on the overview, with the choices, Other and nothing else in
 * the asking session's chat. TAKE_SCREENSHOT=true keeps the pictures in SCREENSHOT_DIR.
 */
test.setTimeout(60000);

const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

async function shot(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = process.env.SCREENSHOT_DIR ?? 'test-results/needs-you';
	await page.screenshot({ path: `${directory}/${name}.png`, animations: 'disabled' });
}

async function home(page: Page, size: keyof typeof sizes, change: 'two-asks' | 'no-choices') {
	await page.setViewportSize(sizes[size]);
	await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
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
const agentsCard = (page: Page) => page.getByRole('region', { name: 'Agents', exact: true });

for (const size of ['desktop', 'phone'] as const) {
	test(`Home lists each open ask as a row that opens its session chat (${size})`, async ({
		page
	}) => {
		const fixture = await home(page, size, 'two-asks');
		const rows = needsYou(page).getByRole('button');
		await expect(rows).toHaveCount(2);
		// The count lives with the items in the blockers section; Agents shows only agents.
		await expect(needsYou(page).getByText('2 need you', { exact: true })).toBeVisible();
		await expect(agentsCard(page)).toBeVisible();
		await expect(agentsCard(page).getByText(/\d+ needs? you/)).toHaveCount(0);
		await expect(rows.filter({ hasText: 'harbor' })).toContainText(
			/Ship harbor\?.*waiting \d+[mhd]/s
		);
		// The overview offers no answer controls at all.
		await expect(page.getByRole('group', { name: 'Choose an answer' })).toHaveCount(0);
		await expect(page.getByRole('textbox')).toHaveCount(0);
		await shot(page, `hub-home-needs-you-${size}`);

		await rows.filter({ hasText: 'harbor' }).click();
		const chat = page.getByRole('region', { name: 'Chat with harbor' });
		const latest = chat
			.getByRole('list', { name: 'Tracker conversation' })
			.getByRole('listitem')
			.last();
		await expect(latest.getByText('Ship harbor?')).toBeVisible();
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
	await needsYou(page).getByRole('button').filter({ hasText: 'harbor' }).click();
	await page.getByRole('button', { name: /Hold harbor/ }).click();
	await expect.poll(() => fixture.sent.length).toBe(1);
	expect(fixture.sent[0]).toMatchObject({ agentId: 'harbor', kind: 'answer', option: 2 });
});

test('a flag without choices is not counted, listed or answerable', async ({ page }) => {
	await home(page, 'desktop', 'no-choices');
	await expect(needsYou(page)).toHaveCount(0);
	await expect(page.getByText(/\d+ needs? you/)).toHaveCount(0);
	await expect(page.getByRole('heading', { level: 1 })).not.toContainText('you');
});
