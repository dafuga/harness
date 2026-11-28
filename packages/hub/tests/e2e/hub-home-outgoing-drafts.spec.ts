import { expect, test, type Page } from '../../../../test/support/browserTest';
import type {
	HomeOutgoingAction,
	HomeOutgoingDraft
} from '../../../reports/src/components/projects-sessions/hub-home/hubHomeOutgoingDraft.types';
import { captureNeedsYou } from './hub-home-capture';
import { hubHomeFixture } from './hub-home-fixture';

const id = '77ecc6dd-7d69-4c9c-9981-2804ecc6f93c';
const receipt = 'https://mail.example.test/receipt';
const initial: HomeOutgoingDraft = {
	id,
	revision: 1,
	status: 'draft',
	delivery: 'idle',
	canSend: true,
	message: {
		channel: 'gmail',
		account: 'sender@example.test',
		to: ['to@example.test'],
		cc: ['cc@example.test'],
		subject: 'Friday production notes',
		thread: { label: 'November production schedule', url: 'https://mail.example.test/thread' },
		body: 'Could you confirm the next production date?'
	}
};

async function outgoingFixture(page: Page) {
	const { snapshot } = await hubHomeFixture(page, 'default', true);
	const chief = snapshot.agents.find((agent) => agent.id === 'cos');
	if (chief) chief.messages = [];
	const calls: HomeOutgoingAction[] = [];
	let draft = structuredClone(initial);
	await page.route('**/api/outgoing-drafts', async (route) => {
		if (route.request().method() === 'GET') return route.fulfill({ json: [draft] });
		const action = route.request().postDataJSON() as HomeOutgoingAction;
		calls.push(action);
		switch (action.action) {
			case 'edit':
				draft = {
					...draft,
					revision: draft.revision + 1,
					message: { ...draft.message, ...action.message }
				};
				break;
			case 'send':
				draft = { ...draft, status: 'sent', receipt: { url: receipt } };
				break;
			case 'discard':
				draft = { ...draft, status: 'discarded' };
		}
		return route.fulfill({ json: draft });
	});
	return calls;
}

async function openChat(page: Page) {
	await page.goto('/');
	await page.getByRole('button', { name: 'Open chat', exact: true }).click();
	return page.getByRole('dialog', { name: 'Chief of Staff', exact: true });
}

for (const [name, width, height] of [
	['desktop', 1240, 830],
	['tablet', 820, 1180],
	['phone', 390, 844]
] as const) {
	test(`Hub Home reviews an outgoing draft and keeps its recorded result at ${name} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await page.emulateMedia({
			colorScheme: name === 'desktop' ? 'dark' : 'light',
			reducedMotion: 'reduce'
		});
		const calls = await outgoingFixture(page);
		const chat = await openChat(page);
		await expect(chat).toBeVisible();
		const card = chat.getByRole('article', { name: initial.message.subject });
		if (process.env.SCREENSHOT_LABEL === 'before') await captureNeedsYou(page, `draft-${name}`);
		await expect(card).toBeVisible({ timeout: 4000 });
		expect(calls).toEqual([]);
		await expect(card.getByRole('link', { name: 'November production schedule' })).toHaveAttribute(
			'href',
			initial.message.thread!.url!
		);
		await captureNeedsYou(page, `draft-${name}`);
		await card.getByRole('button', { name: 'Edit' }).click();
		const editor = page.getByRole('dialog', { name: 'Edit draft' });
		await expect(editor.getByRole('textbox', { name: 'Message' })).toHaveValue(
			initial.message.body
		);
		await captureNeedsYou(page, `edit-${name}`);
		await editor.getByRole('textbox', { name: 'Message' }).fill('Please confirm Thursday.');
		await editor.getByRole('button', { name: 'Save changes' }).click();
		await expect(card).toContainText('Please confirm Thursday.');
		const action = name === 'tablet' ? 'discard' : 'send';
		await card
			.getByRole('button', { name: action === 'send' ? 'Send' : 'Discard', exact: true })
			.click();
		await expect(card).toContainText(action === 'send' ? 'Sent' : 'Discarded');
		expect(calls).toEqual([
			{
				action: 'edit',
				id,
				revision: 1,
				message: {
					to: initial.message.to,
					cc: initial.message.cc,
					subject: initial.message.subject,
					body: 'Please confirm Thursday.'
				}
			},
			{ action, id, revision: 2 }
		]);
		await openChat(page);
		if (action === 'send')
			await expect(card.getByRole('link', { name: 'View receipt' })).toHaveAttribute(
				'href',
				receipt
			);
		else await expect(card.getByText('Discarded', { exact: true })).toBeVisible();
		await captureNeedsYou(page, `${action}-${name}`);
	});
}
