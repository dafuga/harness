import { expect, type Locator, type Page } from '@playwright/test';
import { capture, fits, open, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

const store = { category: 'services' as const, entity: ids.store, tab: 'tests' as const };
const branch = 'feature/orders';
const shot = (name: string) => `${process.env.SCREENSHOT_LABEL ?? 'run'}-${name}`;
const examplesOf = (page: Page) =>
	page.getByRole('tabpanel', { name: 'OrderStore examples', exact: true });
const verificationOf = (pane: Locator) =>
	pane.locator(':scope > details').filter({ hasText: 'Verification details' });
/** The authored uses alone, never anything inside the verification disclosure. */
const usesOf = (pane: Locator) => pane.locator(':scope > .examples');

/**
 * A service's former Tests address opens Examples at its branch and revision: how to create it
 * once, then its calls, then recorded verification behind its own disclosure. An older commit
 * keeps its own document, a missing or malformed one says so, and another kind keeps Tests.
 */
export async function reviewServiceExamples(page: Page, viewport: string): Promise<void> {
	for (const commit of [null, commits.middle]) {
		const mode = commit ? 'commit' : 'tip';
		await open(page, { ...store, commit }, 'documented');
		await page.getByRole('tab', { name: /^(?:Tests|Examples)$/ }).waitFor();
		await capture(page, shot(`service-examples-${mode}-${viewport}`));
		await expect(page.getByRole('tab', { name: 'Examples', exact: true })).toHaveCount(1);
		await expect(page.getByRole('tab', { name: 'Tests', exact: true })).toHaveCount(0);
		expect(await where(page)).toMatchObject({ ...store, branch, commit });
		const pane = examplesOf(page);
		await expect(pane).toBeVisible();
		await reviewCalls(pane, commit);
		await reviewGeneratedAudio(pane);
		await reviewVerification(pane);
		await capture(page, shot(`service-verification-${mode}-${viewport}`));
		expect(await fits(page)).toBe(true);
		await page.getByRole('tab', { name: 'Overview', exact: true }).click();
		await page.getByRole('tab', { name: 'Examples', exact: true }).click();
		expect(await where(page)).toMatchObject({ ...store, branch, commit, tab: 'examples' });
		await expect(pane).toBeVisible();
	}
	await reviewGaps(page);
	await reviewOtherKind(page, viewport);
}

/** Generated audio and its matching transcript are usable directly in Examples. */
async function reviewGeneratedAudio(pane: Locator): Promise<void> {
	const audio = pane.locator(':scope > [data-harness-component="harness-entity-audio"]');
	await expect(audio).toBeVisible();
	await expect(audio.getByText('[Synthetic 440 Hz tone; no spoken words.]').first()).toBeVisible();
	const player = audio.locator('audio').first();
	await player.evaluate(async (element: HTMLAudioElement) => {
		element.muted = true;
		await element.play();
	});
	await expect
		.poll(() => player.evaluate((element: HTMLAudioElement) => element.currentTime))
		.toBeGreaterThan(0);
	await player.evaluate((element: HTMLAudioElement) => element.pause());
}

/** Construction leads once; each call follows with its expected result and never a verdict. */
async function reviewCalls(pane: Locator, commit: string | null): Promise<void> {
	const uses = usesOf(pane).getByRole('article');
	const created = commit ? 'new OrderStore("account-7")' : 'new OrderStore(accountId)';
	await expect(uses).toHaveCount(commit ? 2 : 5);
	await expect(uses.first().getByRole('heading')).toHaveText('Create the service');
	await expect(uses.first().locator('code')).toHaveText(`const store = ${created};`);
	for (const use of (await uses.all()).slice(1)) {
		await expect(use.locator(':scope > *')).toHaveCount(2);
		await expect(use.locator('code')).not.toContainText('new OrderStore');
		await expect(use.locator('code')).toContainText(/\/\/ (?:=>|throws) /);
	}
	const [shown, other] = commit
		? ['Read the earlier order list', 'Search orders by name']
		: ['Search orders by name', 'Read the earlier order list'];
	await expect(pane).toContainText(shown);
	await expect(pane).not.toContainText(other);
	if (!commit) {
		await expect(uses.nth(3).locator('code')).toContainText('{ id: 0, archived: false }');
		await expect(uses.nth(3).locator('code')).toContainText('// => null');
		await expect(uses.last().locator('code')).toContainText('// throws');
	}
	await expect(pane.locator('tag')).toHaveCount(0);
	await expect(usesOf(pane)).not.toContainText(/Proven|passed|failed/);
}

/** Recorded verification follows the authored uses, closed, under its own name. */
async function reviewVerification(pane: Locator): Promise<void> {
	const note = pane.getByText('These examples are authored documentation, not test results.');
	await expect(note).toBeVisible();
	const disclosure = verificationOf(pane);
	await expect(disclosure).toHaveCount(1);
	await expect(disclosure).not.toHaveAttribute('open');
	const uses = await usesOf(pane).boundingBox();
	expect(uses!.y + uses!.height).toBeLessThanOrEqual((await disclosure.boundingBox())!.y);
	await disclosure.locator(':scope > summary').click();
	const verdict = disclosure.getByRole('heading', { name: /^Verification at [0-9a-f]{7}$/ });
	await expect(verdict).toBeVisible();
}

/** No document, or a malformed one at an older commit, is a stated gap beside verification. */
async function reviewGaps(page: Page): Promise<void> {
	const pane = examplesOf(page);
	await open(page, store);
	await expect(pane).toContainText('No usage examples are documented at this commit.');
	await expect(usesOf(pane)).toHaveCount(0);
	await expect(verificationOf(pane)).toHaveCount(1);
	await open(page, { ...store, commit: commits.first }, 'documented');
	await expect(pane).toContainText('The documented examples are malformed.');
	await expect(usesOf(pane)).toHaveCount(0);
	await expect(pane).not.toContainText('Read the orders of an account');
}

/** A config keeps Tests: authored Examples belong to functions and services alone. */
async function reviewOtherKind(page: Page, viewport: string): Promise<void> {
	await open(page, { category: 'configs', entity: ids.settings, tab: 'tests' }, 'documented');
	await expect(page.getByRole('tab', { name: 'Tests', exact: true })).toHaveCount(1);
	await expect(page.getByRole('tab', { name: 'Examples', exact: true })).toHaveCount(0);
	await expect(page.getByRole('tabpanel', { name: / tests$/ })).toBeVisible();
	await capture(page, shot(`config-tests-${viewport}`));
	expect(await fits(page)).toBe(true);
}
