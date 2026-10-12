import { expect, test, type Page } from '@playwright/test';
import {
	atlas,
	atlasThread,
	borealis,
	earlier,
	hostedFixture,
	imageSha,
	tip,
	type HostedState
} from './hosted-fixture';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const execution = /\/(runs|plans|approve|changes)(\/|$)/;
const message = (page: Page) => page.getByRole('textbox', { name: 'Message', exact: true });
const entity = (project: string, revision: string) =>
	`/projects/${project}/harness/branch/${revision}/pages/page.activity`;
const writes = (state: HostedState) => state.calls.filter((call) => call.method !== 'GET');

async function noAgentControls(page: Page) {
	await expect(page.getByRole('group', { name: 'Request mode' })).toHaveCount(0);
	for (const name of ['Plan', 'Change', 'Codex CLI', 'Claude CLI'])
		await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
	await expect(page.getByLabel('Model', { exact: true })).toHaveCount(0);
	await expect(page.getByLabel('Reasoning effort', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Approve/ })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Add local project', exact: true })).toHaveCount(0);
}

test('the hosted workspace has no agent control and a comment never calls a run', async ({
	page
}) => {
	const state = await hostedFixture(page);
	await page.goto(`/projects/${atlas}/harness/pages`);
	await expect(page).toHaveURL(new RegExp(`/projects/${atlas}/harness/branch/main/pages$`));
	await expect(page.getByRole('heading', { name: 'Atlas activity', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: /New page/ })).toHaveCount(0);
	await noAgentControls(page);
	const open = page.getByRole('link', { name: /Open page/ });
	await expect(open).toHaveAttribute('href', entity(atlas, 'main'));
	await open.click();
	await expect(
		page.getByRole('img', { name: 'Atlas activity v001 desktop default' })
	).toBeVisible();
	await noAgentControls(page);
	await page.getByRole('button', { name: 'Open thread 1', exact: true }).click();
	await expect(page.getByText('Atlas: align the filters.')).toBeVisible();
	await expect(page.getByText('Ben Example', { exact: true })).toBeVisible();
	await message(page).fill('Agreed, one line');
	await page.getByRole('button', { name: 'Send comment', exact: true }).click();
	await expect(page.getByText('Saved to GitHub · fffffff', { exact: true })).toBeVisible();
	await expect(page.getByText('Agreed, one line', { exact: true })).toBeVisible();
	await expect(page.getByText(/Pending on this device/)).toHaveCount(0);
	const sent = writes(state);
	expect(sent).toHaveLength(1);
	expect(sent[0].path).toBe(`/api/projects/${atlas}/comments`);
	expect(sent[0].body).toMatchObject({
		projectId: atlas,
		threadId: atlasThread,
		text: 'Agreed, one line',
		anchor: { branch: 'main', commit: tip, entityId: 'page.activity', imageSha256: imageSha }
	});
	expect(String(sent[0].body?.requestId)).toMatch(uuid);
	expect(Object.keys(sent[0].body ?? {}).sort()).toEqual(
		['anchor', 'projectId', 'requestId', 'text', 'threadId'].sort()
	);
	expect(state.calls.filter((call) => execution.test(call.path))).toEqual([]);
	expect(state.calls.every((call) => !call.path.includes('/api/github/'))).toBe(true);
});

test('a comment on a historical commit names that commit', async ({ page }) => {
	const state = await hostedFixture(page);
	await page.goto(entity(atlas, `main/commit/${earlier}`));
	await expect(
		page.getByText(`Historical commit · ${earlier.slice(0, 7)}`, { exact: true })
	).toBeVisible();
	await noAgentControls(page);
	await page.getByRole('button', { name: 'Comment on image', exact: true }).click();
	await message(page).fill('This was clearer');
	await page.getByRole('button', { name: 'Send comment', exact: true }).click();
	await expect(page.getByText(/Saved to GitHub/)).toBeVisible();
	expect(writes(state)[0].body).toMatchObject({
		anchor: { commit: earlier, version: 'v001', imageSha256: imageSha, region: null }
	});
	expect(writes(state)[0].body).not.toHaveProperty('threadId');
});

test('changing project leaves nothing of the previous one and reads only the new one', async ({
	page
}) => {
	const state = await hostedFixture(page);
	await page.goto(entity(atlas, 'main'));
	await page.getByRole('button', { name: 'Open thread 1', exact: true }).click();
	await expect(page.getByText('Atlas: align the filters.')).toBeVisible();
	const project = page.getByLabel('Project', { exact: true });
	await expect(project.locator('option')).toHaveText(['Atlas', 'Borealis']);
	await expect(project.locator('optgroup')).toHaveAttribute('label', 'Shared');
	const before = state.calls.length;
	await project.selectOption(borealis);
	await expect(page).toHaveURL(new RegExp(`/projects/${borealis}/harness/branch/trunk/pages$`));
	await expect(page.getByRole('heading', { name: 'Borealis activity', exact: true })).toBeVisible();
	await expect(page.getByRole('main').getByText(/Atlas/)).toHaveCount(0);
	await expect(page.getByRole('complementary', { name: 'Design conversation' })).toHaveCount(0);
	await expect(page.getByRole('main').getByRole('img')).toHaveCount(0);
	await page.getByRole('link', { name: /Open page/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Borealis activity' })).toBeVisible();
	await expect(page.getByText('Atlas: align the filters.')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^Thread 1/ })).toHaveCount(0);
	const later = state.calls.slice(before).filter((call) => call.path !== '/api/projects');
	expect(later.length).toBeGreaterThan(0);
	expect(later.filter((call) => !call.path.startsWith(`/api/projects/${borealis}/`))).toEqual([]);
});

test('a viewer reads the project and is offered no way to comment', async ({ page }) => {
	const state = await hostedFixture(page);
	await page.goto(entity(borealis, 'trunk'));
	await expect(page.getByRole('heading', { level: 1, name: 'Borealis activity' })).toBeVisible();
	await expect(message(page)).toBeDisabled();
	await expect(page.getByText(/Commenting is not available to you/)).toBeVisible();
	await expect(page.getByRole('button', { name: /^Send/ })).toBeDisabled();
	await noAgentControls(page);
	expect(writes(state)).toEqual([]);
});

test('signed out, the workspace asks for sign-in and reads no project', async ({ page }) => {
	const state = await hostedFixture(page, { signedIn: false });
	await page.goto(entity(atlas, 'main'));
	await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
	await expect(page.getByText('Sign in to open this project.')).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Catalog categories' })).toHaveCount(0);
	expect(state.calls.filter((call) => call.path.startsWith('/api/projects'))).toEqual([]);
});
