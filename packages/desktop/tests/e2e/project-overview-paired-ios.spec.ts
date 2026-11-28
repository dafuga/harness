import { captureIosAccountState } from './support/captureIosAccountState';
import { expect as baseExpect, test } from '../../../../test/support/browserTest';
import type { Page } from '@playwright/test';
import {
	setLoginStage,
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
const expect = baseExpect.configure({ timeout: 25_000 });
test.setTimeout(90_000);

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

test('an unpaired owner can open Tracker overview with the Google account alone', async ({
	page
}) => {
	await page.setViewportSize(phone);
	await pairedPhoneFixture(page, 'unpaired');
	await openFromLanding(page);
	await expect(page.getByText('fixture-needs', { exact: true }).first()).toBeVisible();
	await expectReadsOnly(page);
});

test('iOS opens at Google sign-in before it reads Tracker or projects', async ({ page }) => {
	await page.setViewportSize(phone);
	await pairedPhoneFixture(page, 'sign-in');
	await page.goto('/projects');
	const google = page.getByRole('button', { name: 'Sign in with Google' });
	await expect(google).toBeVisible();
	expect(await pairedAccountCalls(page)).toEqual([]);
	await captureIosAccountState(page, 'sign-in');
	await google.click();
	await expect(page.getByRole('status')).toHaveText('Waiting for Google…');
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(google).toBeVisible();
	expect(await pairedAccountCalls(page)).toEqual([]);
	await google.click();
	await setLoginStage(page, 'waiting-for-approval');
	await expect(page.getByText('Waiting for Google…')).toHaveCount(0);

	await expect(page.getByText('Waiting for approval', { exact: true })).toBeVisible();
	await expect(page.getByText('018427', { exact: true })).toBeVisible();
	await captureIosAccountState(page, 'waiting');
	await setLoginStage(page, 'approval-denied');
	const alert = page.getByRole('alert');
	await expect(alert).toBeVisible();
	await captureIosAccountState(page, 'denied');
	await expect(alert).toHaveText('Device approval was denied.');
	await expect(page.getByText('018427', { exact: true })).toHaveCount(0);
	const back = page.getByRole('button', { name: 'Back to sign in' });
	expect((await back.boundingBox())?.height).toBeGreaterThanOrEqual(44);
	await back.click();
	await expect(google).toBeVisible();
	expect(await pairedAccountCalls(page)).toEqual([]);
	await google.click();
	await setLoginStage(page, 'approval-expired');
	await expect(alert).toHaveText('Device approval expired.');
	await captureIosAccountState(page, 'expired');
	await page.getByRole('button', { name: 'Back to sign in' }).click();
	await google.click();
	await setLoginStage(page, 'signed-in');
	await expect(page).toHaveURL(/\/$/);
	await overviewLink(page).click();
	await expect(page.getByText('fixture-needs', { exact: true }).first()).toBeVisible();
});

test('a signed-in non-owner is denied on confirmation, so the landing page offers no overview', async ({
	page
}) => {
	await page.setViewportSize(phone);
	await pairedPhoneFixture(page, 'non-owner');
	await page.goto('/');
	await expect
		.poll(
			async () =>
				(await pairedAccountCalls(page)).filter((call) => call.path === overviewPath).length
		)
		.toBe(1);
	await expect(overviewLink(page)).toHaveCount(0);
	await expectReadsOnly(page);
});

test('a revoked computer pairing leaves the signed-in Hub overview available', async ({ page }) => {
	await page.setViewportSize(phone);
	await pairedPhoneFixture(page, 'owner');
	await openFromLanding(page);
	await expect(page.getByText('fixture-needs', { exact: true }).first()).toBeVisible();
	const before = (await expectReadsOnly(page)).length;
	await setPairedState(page, 'revoked');
	await expect(page.getByText('fixture-needs', { exact: true }).first()).toBeVisible();
	const calls = await expectReadsOnly(page);
	expect(calls.length).toBe(before);
	await setPairedState(page, 'offline');
	await page.getByRole('link', { name: 'Back to Harness' }).click();
	const inbox = page.getByRole('link', { name: 'Needs you', exact: true });
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await expect(page.getByRole('img', { name: 'Harness', exact: true })).toBeVisible();
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({
			path: `/tmp/harness-ios-inbox-home-${process.env.SCREENSHOT_LABEL}.png`
		});
	}
	await inbox.click({ timeout: 5000 });
	await expect(page).toHaveURL(/\/tracker$/);
	await expect(page.getByRole('heading', { name: 'Needs you', exact: true })).toBeVisible();
	await expect(page.getByText('Showing the last copy. It may be out of date.')).toBeVisible();
	await page.getByRole('button', { name: /Fixture planning item/ }).click();
	await expect(page.getByRole('heading', { name: 'Fixture planning item' })).toBeVisible();
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({ path: `/tmp/harness-y3y889-${process.env.SCREENSHOT_LABEL}.png` });
	}
	await expect(page.getByText('Detailed idea', { exact: true }).first()).toBeVisible();
	await expect(page.getByRole('link', { name: 'Main page design' })).toHaveAttribute(
		'href',
		'https://example.test/design.png'
	);
	await expect(page.getByText(/Fixture Planner/)).toBeVisible();
	await page.getByRole('link', { name: 'Home', exact: true }).click();
	await expect(page).toHaveURL(/\/$/);
});

test('a denial after the card is shown clears it on focus and captures the denied state', async ({
	page
}) => {
	await page.setViewportSize(phone);
	await pairedPhoneFixture(page, 'denied');
	await openFromLanding(page);
	await expect(page.getByText('fixture-needs', { exact: true }).first()).toBeVisible();
	/** The paired, visible page re-reads on focus; the Hub now denies this owner, so the old card goes. */
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
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
