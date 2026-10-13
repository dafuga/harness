import { expect, test, type Page } from '@playwright/test';
import { captured, remoteEvidence } from './remote-evidence';
import { deviceName, remotePhoneFixture } from './ui-remote-phone-fixture';

/**
 * Scans that end without an offer, on the SYNTHETIC native plugin of the phone fixture: no
 * camera and no code exist here. Each ending says what happened and offers another scan, and
 * nothing reaches a computer. Four of them are states of the scenario `remote-mobile-ui`.
 */
type Call = Record<string, unknown>;
const made = async (page: Page, op: string) =>
	(await page.evaluate(() => (window as unknown as { __calls: Call[] }).__calls)).filter(
		(call) => call.op === op
	);
const computer = (page: Page) => page.getByRole('region', { name: 'Computer connection' });
const field = (page: Page, name: string) =>
	computer(page).getByRole('textbox', { name, exact: true });
const fits = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
/** How the next scans of the SYNTHETIC scanner end, in order; after them a scan goes well. */
const script = (page: Page, outcomes: string[]) =>
	page.evaluate(
		(codes) =>
			(window as unknown as { __remotePhone: { scans: string[] } }).__remotePhone.scans.push(
				...codes
			),
		outcomes
	);
/** The endings the scenario names as states; the others are asserted here all the same. */
const states: Record<string, string> = {
	'camera-denied': 'phone-scan-denied',
	'scan-cancelled': 'phone-scan-cancelled',
	'offer-invalid': 'phone-scan-invalid',
	'offer-expired': 'phone-scan-expired'
};

test.use({ viewport: { width: 390, height: 844 } });

test('a scan that ends without an offer says why and can be tried again; nothing is sent meanwhile', async ({
	page
}, testInfo) => {
	await remotePhoneFixture(page);
	await page.goto('/');
	const panel = computer(page);
	await expect(panel.getByRole('heading', { name: 'Connect to computer' })).toBeVisible();
	await captured(page, testInfo, 'phone-before-scan', panel);
	const outcomes = [
		['camera-denied', 'Camera access is off for Harness'],
		['scan-cancelled', 'Scanning was cancelled'],
		['offer-invalid', 'That is not a Harness pairing code'],
		['offer-expired', 'That code has expired'],
		['offer-unsupported', 'another version of Harness'],
		['offer-environment', 'this build of Harness does not accept'],
		['camera-unavailable', 'no camera that can scan']
	];
	await script(
		page,
		outcomes.map(([code]) => code)
	);
	await field(page, 'Name of this phone').fill(deviceName);
	await panel.getByRole('button', { name: 'Scan QR code', exact: true }).click();
	for (const [code, words] of outcomes) {
		await expect(panel.getByRole('alert')).toContainText(words);
		await expect(panel.getByText(/Waiting for approval/)).toHaveCount(0);
		await expect(panel.getByRole('heading', { name: 'Connect to computer' })).toBeVisible();
		await expect(panel.getByRole('button', { name: 'Scan again', exact: true })).toBeVisible();
		await expect(panel.getByRole('textbox')).toHaveCount(1);
		expect(await fits(page)).toBe(true);
		if (states[code]) await remoteEvidence(page, testInfo, states[code]);
		else await captured(page, testInfo, `phone-${code}`, panel);
		await panel.getByRole('button', { name: 'Scan again', exact: true }).click();
	}
	await expect(panel.getByText(/Waiting for approval/)).toBeVisible();
	expect((await made(page, 'native.scan')).map((call) => call.outcome)).toEqual([
		...outcomes.map(([code]) => code),
		'ok'
	]);
	expect(await made(page, 'native.request')).toEqual([]);
});
