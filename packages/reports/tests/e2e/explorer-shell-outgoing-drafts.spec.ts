import { expect, test, type Page } from '../../../../test/support/browserTest';
import { buildShellFixture, openShellPage, removeShellFixture } from './support/shellFixture';

let home = '';
test.beforeAll(() => {
	test.setTimeout(120_000);
	home = buildShellFixture(['outgoing']);
});
test.afterAll(() => removeShellFixture(home));

async function screenshot(page: Page, name: string) {
	const path = process.env.OUTGOING_SCREENSHOTS;
	if (!path) return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(
			[...document.querySelectorAll('dialog[open] img')].map(async (image) => {
				if (!(image instanceof HTMLImageElement)) return;
				await image.decode();
				if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
					throw new Error('A draft screenshot image did not render.');
				}
			})
		);
	});
	await page.screenshot({ path: `${path}/${name}.png`, animations: 'disabled', caret: 'hide' });
}

async function open(page: Page, state = 'idle') {
	await openShellPage(page, home, 'outgoing', `?state=${state}`);
	await page.getByRole('button', { name: 'Open chat' }).click();
	return page.getByRole('dialog', { name: 'Chief of Staff', exact: true });
}

const revision = { id: 'fixture-draft', revision: 8 };
const calls = (page: Page) => page.evaluate(() => Reflect.get(window, 'outgoingFixtureCalls'));

for (const [size, width, height] of [
	['desktop', 1240, 830],
	['tablet', 768, 900],
	['phone', 390, 844]
] as const) {
	test(`the shared conversation reviews and edits an exact draft revision at ${size} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await page.emulateMedia({ colorScheme: size === 'desktop' ? 'dark' : 'light' });
		const chat = await open(page);
		await screenshot(page, `draft-${size}`);
		const card = chat.getByRole('article', { name: 'Friday production notes' });
		await expect(card).toBeVisible({ timeout: 2500 });
		await expect(card.getByText('studio@example.test', { exact: true })).toBeInViewport({
			ratio: 1
		});
		await expect(card.getByRole('textbox')).toHaveCount(0);
		await expect(card.getByRole('link', { name: 'November production schedule' })).toHaveAttribute(
			'href',
			'https://example.test/thread'
		);
		expect(await card.evaluate((node) => node.scrollWidth)).toBeLessThanOrEqual(
			await card.evaluate((node) => node.clientWidth + 1)
		);
		const edit = card.getByRole('button', { name: 'Edit' });
		await edit.click();
		const editor = page.getByRole('dialog', { name: 'Edit draft' });
		await expect(editor.getByRole('textbox', { name: 'Message' })).toHaveValue(/Could you confirm/);
		await screenshot(page, `editor-${size}`);
		if (size === 'phone') {
			await page.setViewportSize({ width, height: 490 });
			await expect(editor.getByRole('button', { name: 'Save changes' })).toBeInViewport();
			await page.setViewportSize({ width, height });
		}
		await page.keyboard.press('Escape');
		await expect(edit).toBeFocused();
		await edit.click();
		await editor.getByRole('textbox', { name: 'Message' }).fill('A revised note.');
		await editor.getByRole('button', { name: 'Save changes' }).click();
		await expect
			.poll(() => calls(page))
			.toMatchObject([{ action: 'edit', ...revision, changes: { body: 'A revised note.' } }]);
		await expect(card).toContainText('A revised note.');
		await card.getByRole('button', { name: 'Send', exact: true }).click();
		await expect
			.poll(() => calls(page))
			.toMatchObject([{}, { action: 'send', ...revision, revision: 9 }]);
		await expect(card.getByText('Sending', { exact: true })).toBeVisible();
		await expect(card.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
	});
}

test('delivery states retain the draft and restrict actions to confirmed outcomes', async ({
	page
}) => {
	for (const [state, label] of [
		['sending', 'Sending'],
		['failed', 'Delivery failed'],
		['unconfirmed', 'Delivery unconfirmed'],
		['sent', 'Sent'],
		['discarded', 'Discarded']
	] as const) {
		const chat = await open(page, state);
		const card = chat.getByRole('article', { name: 'Friday production notes' });
		await expect(card).toBeInViewport({ ratio: 1 });
		await expect(card.getByText(label, { exact: true })).toBeVisible();
		await screenshot(page, state);
		if (state === 'failed') {
			await expect(card).toContainText('The mail provider was unavailable.');
			await card.getByRole('button', { name: 'Retry send' }).click();
			await expect.poll(() => calls(page)).toEqual([{ action: 'send', ...revision }]);
		} else if (state === 'sent') {
			await expect(card.getByRole('link', { name: 'View receipt' })).toHaveAttribute(
				'href',
				'https://example.test/receipt'
			);
		} else {
			await expect(card.getByRole('button', { name: 'Retry send' })).toHaveCount(0);
		}
		if (state === 'sent' || state === 'discarded') {
			await expect(card.getByRole('button')).toHaveCount(0);
		}
	}
	const awaiting = (await open(page, 'awaiting')).getByRole('article');
	await awaiting.getByRole('button', { name: 'Send', exact: true }).click();
	await expect(awaiting.getByText('Sending', { exact: true })).toBeVisible();
	await expect(awaiting.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
	const lost = (await open(page, 'lost-response')).getByRole('article');
	await lost.getByRole('button', { name: 'Send', exact: true }).click();
	await expect(lost.getByText('Delivery unconfirmed', { exact: true })).toBeVisible();
	await expect(lost.getByRole('button')).toHaveCount(0);
	const unsafe = (await open(page, 'unsafe')).getByRole('article');
	await expect(unsafe.getByText('November production schedule')).toBeVisible();
	await expect(unsafe.getByRole('link')).toHaveCount(0);
	const chat = await open(page);
	await chat.getByRole('button', { name: 'Discard', exact: true }).click();
	await expect.poll(() => calls(page)).toEqual([{ action: 'discard', ...revision }]);
	await expect(chat.getByRole('article')).toContainText('Discarded');
});
