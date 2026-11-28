import { expect, test, type Page } from '../../../../test/support/browserTest';
import type {
	HomeOutgoingAction,
	HomeOutgoingDraft
} from '../../../reports/src/components/projects-sessions/hub-home/hubHomeOutgoingDraft.types';
import { capturePlanWork } from './support/trackerWorkEvidence';
import { trackerWorkFixture } from './support/trackerWorkFixture';
import { projectFixture } from './ui-project-fixture';
import { remotePhoneFixture } from './ui-remote-phone-fixture';

const id = '77ecc6dd-7d69-4c9c-9981-2804ecc6f93c';
const subject = 'Friday production notes';
const url = 'https://mail.example.test/receipt';
const initial: HomeOutgoingDraft = {
	id,
	revision: 3,
	status: 'draft',
	delivery: 'idle',
	canSend: true,
	message: {
		channel: 'gmail',
		account: 'sender@example.test',
		to: ['to@example.test'],
		cc: [],
		subject,
		body: 'Could you confirm the next production date?'
	}
};

async function nativeOutgoing(page: Page, mode: 'mac' | 'iphone') {
	if (mode === 'mac') await projectFixture(page);
	else await remotePhoneFixture(page, 'online');
	await trackerWorkFixture(page, mode);
	const approvals: HomeOutgoingAction[] = [];
	let draft = structuredClone(initial);
	let complete = () => {};
	const acceptance = new Promise<void>((resolve) => (complete = resolve));
	await page.exposeFunction('__reviewOutgoing', async (action?: HomeOutgoingAction) => {
		if (!action) return [draft];
		approvals.push(action);
		draft = { ...draft, delivery: 'sending' };
		await acceptance;
		draft = { ...draft, status: 'sent', delivery: 'idle', receipt: { url } };
		return draft;
	});
	await page.addInitScript((kind) => {
		const host = window as unknown as {
			harness: Record<string, unknown>;
			Capacitor: { nativePromise: (plugin: string, method: string, input: unknown) => unknown };
			__reviewOutgoing: (input?: unknown) => Promise<unknown>;
		};
		if (kind === 'mac') {
			host.harness.homeOutgoing = {
				read: () => host.__reviewOutgoing(),
				write: (action: unknown) => host.__reviewOutgoing(action)
			};
			return;
		}
		const native = host.Capacitor.nativePromise;
		host.Capacitor.nativePromise = async (plugin, method, input) => {
			const call = input as { path?: string; body?: unknown };
			if (
				plugin === 'HarnessAccount' &&
				method === 'request' &&
				call.path === '/api/outgoing-drafts'
			) {
				const result = await host.__reviewOutgoing(call.body);
				return { status: 200, contentType: 'application/json', data: btoa(JSON.stringify(result)) };
			}
			return native(plugin, method, input);
		};
	}, mode);
	return { approvals, complete };
}

for (const mode of ['mac', 'iphone'] as const) {
	test(`${mode} shows the outgoing draft and records an exact owner approval in chat`, async ({
		page
	}) => {
		await page.setViewportSize(
			mode === 'mac' ? { width: 1440, height: 900 } : { width: 390, height: 844 }
		);
		await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
		const fixture = await nativeOutgoing(page, mode);
		await page.goto(mode === 'mac' ? '/' : '/tracker?view=work');
		await page.getByRole('button', { name: 'Open chat', exact: true }).click();
		const chat = page.getByRole('dialog', { name: 'Chief of Staff', exact: true });
		const card = chat.getByRole('article', { name: subject });
		await expect(card).toBeVisible();
		await expect(card.getByText('sender@example.test')).toBeVisible();
		expect(fixture.approvals).toEqual([]);
		await capturePlanWork(page, mode, 'outgoing-draft');
		await card.getByRole('button', { name: 'Edit', exact: true }).click();
		const editor = page.getByRole('dialog', { name: 'Edit draft' });
		await expect(editor.getByRole('textbox', { name: 'Message' })).toHaveValue(
			initial.message.body
		);
		await capturePlanWork(page, mode, 'outgoing-edit');
		await editor.getByRole('button', { name: 'Cancel' }).click();
		await expect(card.getByRole('button', { name: 'Edit', exact: true })).toBeFocused();
		const send = card.getByRole('button', { name: 'Send', exact: true });
		await send.click();
		await expect(card.getByText('Sending', { exact: true })).toBeVisible();
		await expect(send).toBeDisabled();
		await capturePlanWork(page, mode, 'outgoing-sending');
		expect(fixture.approvals).toEqual([{ action: 'send', id, revision: 3 }]);
		fixture.complete();
		await expect(card.getByRole('link', { name: 'View receipt' })).toHaveAttribute('href', url);
		await capturePlanWork(page, mode, 'outgoing-sent');
	});
}
