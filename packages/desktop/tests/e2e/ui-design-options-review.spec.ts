import { expect, test, type Page } from '../../../../test/support/browserTest';
import { hostedFixture } from './ui-hosted-fixture';
import {
	designOptionsFixture,
	earlier,
	gamma,
	optionThread,
	sha
} from './ui-design-options-fixture';
import {
	activity,
	at,
	calls,
	count,
	modes,
	option,
	optionGroup,
	remember,
	shows
} from './ui-design-options-helpers';

/**
 * The options of one version are reviewed one at a time: the option shown is the exact image
 * that threads, approval, Change and a revising Plan are bound to. Pinned commits and shared
 * projects switch options too, without agent controls. SYNTHETIC fixture, no generation.
 */
const send = async (page: Page, mode: string, text: string) => {
	await page.getByRole('textbox', { name: 'Message', exact: true }).fill(text);
	await page.getByRole('button', { name: `Send ${mode}`, exact: true }).click();
};

test('each option shows its own image, and a new thread is anchored to the option shown', async ({
	page
}, info) => {
	await designOptionsFixture(page);
	await page.goto(at(activity));
	await expect(page.getByRole('img', { name: /\bv003\b/ }).first()).toBeVisible();
	await expect(option(page, 1)).toHaveAttribute('aria-pressed', 'true');
	await shows(page, 'o1');
	await remember(page, info, 'options');
	await expect(page.getByRole('button', { name: 'Open thread 3', exact: true })).toHaveCount(0);
	await option(page, 2).click();
	await shows(page, 'o2');
	await expect(page.getByRole('button', { name: 'Open thread 3', exact: true })).toBeVisible();
	await option(page, 3).click();
	await shows(page, 'o3');
	await page.getByRole('button', { name: 'Select region with keyboard' }).click();
	await page.getByRole('button', { name: 'Comment on region', exact: true }).click();
	await modes(page).getByRole('button', { name: 'Plan', exact: true }).click();
	await send(page, 'plan', 'Tighten the blue option');
	await expect.poll(async () => (await calls(page, 'openThread')).length).toBe(1);
	const [opened] = await calls(page, 'openThread');
	expect(opened).toMatchObject({ version: 'v003', option: 'o3', imageSha256: sha('o3') });
});

test('approval binds the option shown, and Change runs only on that approved option', async ({
	page
}, info) => {
	await designOptionsFixture(page);
	await page.goto(at(activity));
	await option(page, 2).click();
	await shows(page, 'o2');
	await page.getByRole('button', { name: 'Approve v003', exact: true }).click();
	await expect.poll(async () => (await calls(page, 'approve')).length).toBe(1);
	const [approved] = await calls(page, 'approve');
	expect(approved).toMatchObject({ version: 'v003', option: 'o2', imageHashes: [sha('o2')] });
	const change = modes(page).getByRole('button', { name: 'Change', exact: true });
	await expect(change).toBeEnabled();
	await remember(page, info, 'approve');
	await option(page, 1).click();
	await shows(page, 'o1');
	await expect(change).toBeDisabled();
	await option(page, 2).click();
	await change.click();
	await expect(count(page)).toHaveCount(0);
	await send(page, 'change', 'Implement the approved green option');
	await expect.poll(async () => (await calls(page, 'startRun')).length).toBe(1);
	const [run] = await calls(page, 'startRun');
	expect(run).toMatchObject({
		mode: 'change',
		approval: { version: 'v003', option: 'o2', imageHashes: [sha('o2')] }
	});
});

test('a revising Plan in an option thread is anchored to that option image', async ({
	page
}, info) => {
	await designOptionsFixture(page);
	await page.goto(at(activity));
	await option(page, 2).click();
	await page.getByRole('button', { name: 'Open thread 3', exact: true }).click();
	await expect(page.getByText('Option 2: keep the green header.')).toBeVisible();
	await expect(option(page, 2)).toHaveAttribute('aria-pressed', 'true');
	await shows(page, 'o2');
	await remember(page, info, 'option-thread');
	await modes(page).getByRole('button', { name: 'Plan', exact: true }).click();
	await send(page, 'plan', 'Keep the header, soften the green');
	await expect.poll(async () => (await calls(page, 'startRun')).length).toBe(1);
	const [run] = await calls(page, 'startRun');
	expect(run).toMatchObject({ mode: 'plan', threadId: optionThread, designOptions: 3 });
	expect(await calls(page, 'openThread')).toEqual([]);
});

test('at a pinned commit every option can be viewed and none can be approved or planned', async ({
	page
}, info) => {
	await designOptionsFixture(page);
	await page.goto(at(`commit/${earlier}/${activity}`));
	await expect(page.getByRole('img', { name: /\bv003\b/ }).first()).toBeVisible();
	await option(page, 3).click();
	await shows(page, 'o3');
	await expect(page.getByRole('button', { name: /^Approve/, disabled: false })).toHaveCount(0);
	await expect(count(page)).toHaveCount(0);
	expect(await calls(page, 'approve')).toEqual([]);
	await remember(page, info, 'pinned');
});

test('a shared project switches options and offers no agent, count or approval', async ({
	page
}, info) => {
	await designOptionsFixture(page, hostedFixture);
	await page.goto(at(activity, gamma));
	await expect(page.getByRole('img', { name: /\bv003\b/ }).first()).toBeVisible();
	await expect(optionGroup(page).getByRole('button')).toHaveCount(3);
	await option(page, 2).click();
	await shows(page, 'o2');
	await expect(page.getByRole('button', { name: 'Work with agent', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^Approve/ })).toHaveCount(0);
	await expect(count(page)).toHaveCount(0);
	await remember(page, info, 'shared');
});
