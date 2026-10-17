import { expect, test, type Page } from '../../../../test/support/browserTest';
import {
	alpha,
	alphaThread,
	earlier,
	gamma,
	imageSha,
	openedThread,
	projectFixture,
	tip
} from './ui-project-fixture';

type Call = Record<string, unknown>;
const calls = (page: Page) =>
	page.evaluate(() => (window as unknown as { __calls: Call[] }).__calls);
const made = async (page: Page, op: string) => (await calls(page)).filter((call) => call.op === op);
const message = (page: Page) => page.getByRole('textbox', { name: 'Message', exact: true });
const modes = (page: Page) => page.getByRole('group', { name: 'Request mode' });
const agentOnly = ['startRun', 'createPlan', 'approve', 'cancelRun'];
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
/** Where the designs of the page are: an entity opens on its overview, its designs are a section. */
const entity = (project: string, revision: string) =>
	`/projects/${project}/harness/branch/${revision}/pages/page%3Aactivity/designs`;

async function comment(page: Page, text: string) {
	await message(page).fill(text);
	await page.getByRole('button', { name: 'Send comment', exact: true }).click();
	await expect(page.getByText(text, { exact: true })).toBeVisible();
}

test('Comment is the default, never starts a run and stays pending after a restart', async ({
	page
}) => {
	await projectFixture(page);
	await page.goto(entity(alpha, 'feat%2Falpha'));
	await expect(modes(page).getByRole('button')).toHaveText(['Comment', 'Plan', 'Change']);
	await expect(modes(page).getByRole('button', { name: 'Comment', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByLabel('Model', { exact: true })).toHaveCount(0);
	await expect(page.getByLabel('Reasoning effort', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Codex CLI', exact: true })).toHaveCount(0);
	await comment(page, 'Tighten the header');
	await expect(page.getByText(/Pending on this device · not shared/)).toBeVisible();
	await expect(
		page.getByText('Saved locally; not synced. Connect a verified shared project to publish.')
	).toBeVisible();
	await expect(page.getByText(/Saved to GitHub/)).toHaveCount(0);
	const sent = await made(page, 'addComment');
	expect(sent).toHaveLength(1);
	expect(sent[0]).toMatchObject({
		projectId: alpha,
		text: 'Tighten the header',
		anchor: { branch: 'feat/alpha', commit: tip, entityId: 'page:activity', region: null }
	});
	expect(String(sent[0].requestId)).toMatch(uuid);
	expect((await calls(page)).filter((call) => agentOnly.includes(String(call.op)))).toEqual([]);
	expect(await made(page, 'openThread')).toEqual([]);
	await page.evaluate(() => {
		localStorage.clear();
		sessionStorage.clear();
	});
	await page.reload();
	await expect(page.getByText('Tighten the header', { exact: true })).toBeVisible();
	await expect(page.getByText(/Pending on this device · not shared/)).toBeVisible();
	await modes(page).getByRole('button', { name: 'Plan', exact: true }).click();
	await expect(page.getByLabel('Model', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Codex CLI', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Send plan', exact: true })).toBeVisible();
});

test('a shared project acknowledges the collaboration commit and offers no agent control', async ({
	page
}) => {
	await projectFixture(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Gamma', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Gamma activity', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: /New page/ })).toHaveCount(0);
	await page.getByRole('link', { name: /Open page/ }).click();
	await expect(message(page)).toBeVisible();
	await expect(modes(page)).toHaveCount(0);
	for (const name of ['Plan', 'Change', 'Codex CLI'])
		await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
	await expect(page.getByLabel('Model', { exact: true })).toHaveCount(0);
	await expect(page.getByLabel('Reasoning effort', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Approve/ })).toHaveCount(0);
	await page.getByRole('button', { name: 'Designs', exact: true }).click();
	await page.getByRole('button', { name: 'Comment on image', exact: true }).click();
	await comment(page, 'Looks right on desktop');
	await expect(page.getByText('Saved to GitHub · fffffff', { exact: true })).toBeVisible();
	await expect(page.getByText(/Pending on this device/)).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Gamma activity · Thread #1' })).toBeVisible();
	await expect(page.getByText('Ada Example', { exact: true })).toBeVisible();
	const sent = await made(page, 'addComment');
	expect(sent).toHaveLength(1);
	expect(sent[0]).toMatchObject({
		projectId: gamma,
		anchor: {
			version: 'v001',
			imageSha256: imageSha,
			state: 'default',
			viewport: 'desktop',
			region: null
		}
	});
	const refused = [...agentOnly, 'openThread', 'providers'];
	expect((await calls(page)).filter((call) => refused.includes(String(call.op)))).toEqual([]);
});

test('a historical commit accepts a comment and offers neither Plan nor Change', async ({
	page
}) => {
	await projectFixture(page);
	await page.goto(entity(alpha, `feat%2Falpha/commit/${earlier}`));
	await expect(message(page)).toBeEnabled();
	await expect(modes(page)).toHaveCount(0);
	for (const name of ['Plan', 'Change'])
		await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Approve v002', exact: true })).toBeDisabled();
	await comment(page, 'This was clearer before');
	await expect(page.getByText(/Pending on this device · not shared/)).toBeVisible();
	expect((await made(page, 'addComment'))[0]).toMatchObject({
		anchor: { branch: 'feat/alpha', commit: earlier, entityId: 'page:activity' }
	});
	expect((await calls(page)).filter((call) => agentOnly.includes(String(call.op)))).toEqual([]);
	expect(await made(page, 'openThread')).toEqual([]);
});

test('a region at a writable tip opens the thread of that image beside its earlier threads', async ({
	page
}) => {
	await projectFixture(page);
	await page.goto(entity(alpha, 'feat%2Falpha'));
	await expect(
		page.getByRole('img', { name: 'Alpha activity v002 desktop default' })
	).toBeVisible();
	await page.getByRole('button', { name: 'Select region with keyboard' }).click();
	await page.getByRole('button', { name: 'Comment on region', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Alpha activity · Thread #2' })).toBeVisible();
	expect((await made(page, 'openThread'))[0]).toMatchObject({
		projectId: alpha,
		entityId: 'page:activity',
		version: 'v002',
		imageSha256: imageSha,
		region: { x: 0.1, y: 0.1, width: 0.4, height: 0.3 }
	});
	const earlierThreads = page.getByRole('group', { name: 'Threads on this image' });
	await expect(earlierThreads.getByRole('button')).toHaveText([/^Thread 1/, /^Thread 2/]);
	await comment(page, 'Narrow this filter');
	expect((await made(page, 'addComment'))[0]).toMatchObject({
		threadId: openedThread,
		anchor: { imageSha256: imageSha, region: { x: 0.1, y: 0.1, width: 0.4, height: 0.3 } }
	});
	await earlierThreads.getByRole('button', { name: /^Thread 1/ }).click();
	await expect(page.getByText('Alpha: keep the filters on one line.')).toBeVisible();
	await comment(page, 'Agreed');
	expect((await made(page, 'addComment'))[1]).toMatchObject({ threadId: alphaThread });
	expect((await calls(page)).filter((call) => agentOnly.includes(String(call.op)))).toEqual([]);
});
