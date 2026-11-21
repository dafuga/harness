import { expect, test } from '../../../../test/support/browserTest';
import type { Page } from '@playwright/test';
import {
	pairedAccountCalls,
	pairedPhoneFixture,
	setPairedState
} from './support/projectOverviewPairedFixture';
import { scenarioCapture } from './scenario-capture';
import scenario from '../../../../specification/scenarios/project-overview-ios-renderer.json' with { type: 'json' };
import type { ScenarioManifest } from '../../../../src/core/unitTypes';

/** The phone viewport the scenario declares: the only size its screenshots are taken at. */
const phone = { width: 390, height: 844 };
const overviewPath = '/api/tracker-overview';

/** The paired landing page's visible link: the only way the overview is opened in these tests. */
const overviewLink = (page: Page) =>
	page.getByRole('link', { name: 'Project Overview', exact: true });

/** Every account request is a read: the paired overview makes no mutation of any kind. */
async function expectReadsOnly(page: Page) {
	const calls = await pairedAccountCalls(page);
	expect(calls.every((call) => call.method === 'GET')).toBe(true);
	return calls;
}

/** Opens the overview from the landing page, as Daniel does: the link is shown, then clicked. */
async function openFromLanding(page: Page) {
	await page.goto('/');
	await overviewLink(page).click();
	await expect(page).toHaveURL(/\/projects$/);
}

test('a paired owner opens the overview from the landing link and sees the synthetic rows', async ({
	page
}) => {
	await page.setViewportSize(phone);
	await pairedPhoneFixture(page, 'owner');
	await page.goto('/');
	await overviewLink(page).click();
	await expect(page.getByText('fixture-needs', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('fixture-done', { exact: true }).first()).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		phone.width
	);
	const calls = await expectReadsOnly(page);
	/** One confirmation of the account from the landing page, then the page's own read. */
	expect(calls.filter((call) => call.path === overviewPath)).toEqual([
		{ method: 'GET', path: overviewPath },
		{ method: 'GET', path: overviewPath }
	]);
	await scenarioCapture(page, scenario as ScenarioManifest, {
		state: 'ready',
		name: 'projects',
		note: 'Synthetic owner overview through the paired iOS account bridge.'
	});
});

test('an open item shows its read-only detail within the page and changes nothing', async ({
	page
}) => {
	await page.setViewportSize(phone);
	await pairedPhoneFixture(page, 'owner');
	await openFromLanding(page);
	await page.getByRole('button', { name: 'Open item', exact: true }).first().click();
	await expect(
		page.getByText('Synthetic question for the owner?', { exact: true }).first()
	).toBeVisible();
	await expect(page).toHaveURL(/\/projects$/);
	await expectReadsOnly(page);
});

test('an unpaired phone offers no overview link and reads nothing, even when signed in', async ({
	page
}) => {
	await page.setViewportSize(phone);
	await pairedPhoneFixture(page, 'unpaired');
	await page.goto('/');
	await expect(overviewLink(page)).toHaveCount(0);
	const calls = await expectReadsOnly(page);
	expect(calls.filter((call) => call.path === overviewPath)).toHaveLength(0);
});

test('a signed-in non-owner is denied on confirmation, so the landing page offers no overview', async ({
	page
}) => {
	await page.setViewportSize(phone);
	await pairedPhoneFixture(page, 'non-owner');
	await page.goto('/');
	await expect.poll(async () => (await pairedAccountCalls(page)).length).toBe(1);
	await expect(overviewLink(page)).toHaveCount(0);
	await expectReadsOnly(page);
});

test('a pairing that is revoked while shown clears the rows and reads nothing more', async ({
	page
}) => {
	await page.setViewportSize(phone);
	await pairedPhoneFixture(page, 'owner');
	await openFromLanding(page);
	await expect(page.getByText('fixture-needs', { exact: true }).first()).toBeVisible();
	const before = (await expectReadsOnly(page)).length;
	await setPairedState(page, 'revoked');
	await expect(page.getByText('fixture-needs', { exact: true })).toHaveCount(0);
	const calls = await expectReadsOnly(page);
	expect(calls.length).toBe(before);
});

test('a denied overview read after the link clears the rows and captures the denied state', async ({
	page
}) => {
	await page.setViewportSize(phone);
	await pairedPhoneFixture(page, 'denied');
	await openFromLanding(page);
	await expect(page.getByText('fixture-needs', { exact: true })).toHaveCount(0);
	await expect(page.getByText('fixture-done', { exact: true })).toHaveCount(0);
	await expectReadsOnly(page);
	await scenarioCapture(page, scenario as ScenarioManifest, {
		state: 'denied',
		name: 'projects',
		note: 'Synthetic denied read: no rows and no account data.'
	});
});

test('an authorized 503 shows unavailable with no rows and captures that state', async ({
	page
}) => {
	await page.setViewportSize(phone);
	await pairedPhoneFixture(page, 'unavailable');
	await openFromLanding(page);
	await expect(page.getByText('fixture-needs', { exact: true })).toHaveCount(0);
	await expect(page.getByText('fixture-blocked', { exact: true })).toHaveCount(0);
	await expectReadsOnly(page);
	await scenarioCapture(page, scenario as ScenarioManifest, {
		state: 'unavailable',
		name: 'projects',
		note: 'Synthetic 503 from the owner overview read: unavailable, no rows.'
	});
});
