import type { Page } from '@playwright/test';
import { expect, test } from '../../../../test/support/browserTest';
import { startInstalledChain } from './installed-chain/chain';
import { joinInstalledChain } from './installed-chain/chainBrowser';
import type { ChainTracker } from './installed-chain/chainTracker.types';
import { asks, note, seed, spec } from './installed-chain/chainData';

/**
 * Home as production runs it: a linked Mac, nothing stored on the Hub, and the installed app's
 * own environment. Every step ends at the Tracker record. Tracker checks are soft, so one run
 * reports each path that is broken. TAKE_SCREENSHOT=true keeps pictures in SCREENSHOT_DIR.
 */
test.setTimeout(240_000);

const soft = expect.configure({ soft: true, timeout: 15_000 });

async function shot(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = process.env.SCREENSHOT_DIR ?? 'test-results/installed-chain';
	await page.screenshot({ path: `${directory}/${name}.png`, animations: 'disabled' });
}

/** Opens Home afresh, reads the ask on its row and opens the asking session's chat. */
async function openAsk(page: Page, ask: (typeof asks)[keyof typeof asks]) {
	await page.goto('/');
	const row = page
		.getByRole('region', { name: /^Blocked - needs you/ })
		.getByRole('button')
		.filter({ hasText: ask.question })
		.filter({ hasText: 'waiting' });
	await expect(row).toBeVisible({ timeout: 30_000 });
	await row.click();
	return page.getByRole('region', { name: `Chat with ${ask.agent}` });
}

async function recorded(tracker: ChainTracker, id: string, answer: object) {
	await soft
		.poll(() => tracker.item(id), { message: `Tracker record of ${id}` })
		.toMatchObject({ needs_daniel: false, answered_by: 'Daniel via Hub', ...answer });
}

async function tapOption(page: Page, tracker: ChainTracker) {
	const chat = await openAsk(page, asks.tap);
	await shot(page, '1-read-ask');
	await chat.getByRole('button', { name: /Hold the release/ }).click();
	await recorded(tracker, asks.tap.id, { answer: 'Hold the release', answer_option: 2 });
}

async function answerOther(page: Page, tracker: ChainTracker) {
	const chat = await openAsk(page, asks.other);
	await chat.getByRole('button', { name: /Other/ }).click();
	const modal = page.getByRole('dialog', { name: 'Other answer' });
	await modal.getByRole('textbox', { name: 'Your answer' }).fill('Ship it after the freeze.');
	await modal.getByRole('button', { name: 'Send answer' }).click();
	await recorded(tracker, asks.other.id, { answer: 'Ship it after the freeze.' });
}

async function sessionNote(page: Page, tracker: ChainTracker) {
	await page.goto('/');
	const agents = page.getByRole('region', { name: 'Agents', exact: true });
	await agents
		.getByRole('button', { name: /^Message/ })
		.first()
		.click();
	const chat = page.getByRole('region', { name: `Chat with ${note.session}` });
	await chat.getByRole('textbox', { name: 'Message' }).fill(note.text);
	await chat.getByRole('button', { name: 'Send' }).click();
	await soft
		.poll(() => JSON.stringify(tracker.item(note.id).notes_log), { message: 'Tracker notes' })
		.toContain(`Hub message: ${note.text}`);
	await shot(page, '3-session-note');
}

/** Reads the attached spec, then answers from beside it. */
async function viewSpec(page: Page, tracker: ChainTracker) {
	const chat = await openAsk(page, asks.spec);
	await chat.getByRole('button', { name: /View spec/ }).click();
	const modal = page.getByRole('dialog', { name: new RegExp(spec.title) });
	const heading = modal
		.getByRole('region', { name: 'Document' })
		.getByRole('heading', { name: spec.heading });
	await soft(heading, 'View spec shows the attached document').toBeVisible();
	await shot(page, '4-view-spec');
	if (!(await heading.isVisible())) return;
	await modal
		.getByRole('region', { name: 'Answer' })
		.getByRole('button', { name: /Approve the spec/ })
		.click();
	await recorded(tracker, asks.spec.id, { answer: 'Approve the spec', answer_option: 1 });
}

test('installed config: read, tap, Other, session note and View spec reach the Tracker', async ({
	page
}) => {
	const chain = await startInstalledChain();
	try {
		await seed(chain.tracker);
		await joinInstalledChain(page, chain.cloud.origin);
		await test.step('read the ask and tap an option', () => tapOption(page, chain.tracker));
		await test.step('answer with Other', () => answerOther(page, chain.tracker));
		await test.step('send a session note', () => sessionNote(page, chain.tracker));
		await test.step('read the spec and answer', () => viewSpec(page, chain.tracker));
		expect(await chain.cloud.stored(), 'the Hub stores no Home snapshot or document').toEqual([]);
	} finally {
		await chain.stop();
	}
});
