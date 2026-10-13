import { expect, test, type Page } from '@playwright/test';
import { remoteEvidence } from './remote-evidence';
import { alpha, deviceName, hostName, remotePhoneFixture } from './ui-remote-phone-fixture';

type Call = Record<string, unknown>;
type Phone = { __remotePhone: { set: (state: string) => void } };
const made = async (page: Page, op: string) =>
	(await page.evaluate(() => (window as unknown as { __calls: Call[] }).__calls)).filter(
		(call) => call.op === op
	);
/** What the native plugin would announce by itself: approval, loss of the host, revocation. */
const announce = (page: Page, state: string) =>
	page.evaluate((value) => (window as unknown as Phone).__remotePhone.set(value), state);
const computer = (page: Page) => page.getByRole('region', { name: 'Computer connection' });
const projects = (page: Page) => page.getByRole('button', { name: /^Open / });
const message = (page: Page) => page.getByRole('textbox', { name: 'Message', exact: true });
const field = (page: Page, name: string) =>
	computer(page).getByRole('textbox', { name, exact: true });
const fits = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const kept = (page: Page) =>
	page.evaluate(() =>
		[document.cookie, ...Object.values(localStorage), ...Object.values(sessionStorage)].join(' ')
	);

test.use({ viewport: { width: 390, height: 844 } });

test('the Capacitor environment pairs by scanning: no link, code or address is ever typed', async ({
	page
}, testInfo) => {
	await remotePhoneFixture(page);
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-environment', 'capacitor');
	const panel = computer(page);
	await expect(panel.getByRole('heading', { name: 'Connect to computer' })).toBeVisible();
	await remoteEvidence(page, testInfo, 'phone-start');
	await expect(page.getByRole('button', { name: 'Open Project', exact: true })).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Phone access' })).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Shared projects' })).toHaveCount(0);
	await expect(projects(page)).toHaveCount(0);
	await expect(panel.getByRole('textbox')).toHaveCount(1);
	await expect(field(page, 'Name of this phone')).toHaveValue('iPhone');
	for (const name of ['Pairing link', 'Pairing code'])
		await expect(field(page, name)).toHaveCount(0);
	await expect(panel.getByRole('button', { name: 'Connect', exact: true })).toHaveCount(0);
	const scan = panel.getByRole('button', { name: 'Scan QR code', exact: true });
	await field(page, 'Name of this phone').fill('   ');
	await scan.click();
	await expect(panel.getByRole('alert')).toContainText('Give this phone a name');
	expect(await made(page, 'native.scan')).toEqual([]);
	await field(page, 'Name of this phone').fill(deviceName);
	await scan.click();
	expect(await made(page, 'native.scan')).toEqual([
		{ op: 'native.scan', deviceName, outcome: 'ok' }
	]);
	await expect(panel.getByText(/Waiting for approval/)).toBeVisible();
	await expect(panel.getByText('Approve this phone in Harness on your computer.')).toBeVisible();
	await expect(panel.getByRole('textbox')).toHaveCount(0);
	await expect(projects(page)).toHaveCount(0);
	expect(await made(page, 'native.request')).toEqual([]);
	expect(await kept(page)).not.toMatch(/harness-pair|KQ7M/i);
	expect(await fits(page)).toBe(true);
	await remoteEvidence(page, testInfo, 'phone-pending');
});

test('approval on the desktop connects the phone and lists only what it was granted', async ({
	page
}, testInfo) => {
	await remotePhoneFixture(page, 'pending-approval');
	await page.goto('/');
	const panel = computer(page);
	await expect(panel.getByText(/Waiting for approval/)).toBeVisible();
	await announce(page, 'online');
	await expect(panel.getByText(`Connected to ${hostName}`)).toBeVisible();
	await expect(panel.getByText(/Computer awake · works while its screen is locked/)).toBeVisible();
	await expect(panel.getByText('2 projects · Plan and Change allowed')).toBeVisible();
	await expect(panel.getByText(`This phone: ${deviceName}`)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open Alpha', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open Beta', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open Gamma', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Open Project', exact: true })).toHaveCount(0);
	expect(await fits(page)).toBe(true);
	await remoteEvidence(page, testInfo, 'phone-connected');
	await announce(page, 'revoked');
	await expect(panel.getByText(/access was removed on the computer/)).toBeVisible();
	await expect(projects(page)).toHaveCount(0);
	await remoteEvidence(page, testInfo, 'phone-revoked');
	await panel.getByRole('button', { name: 'Connect again', exact: true }).click();
	expect((await made(page, 'native.disconnect')).length).toBe(1);
	await expect(panel.getByRole('heading', { name: 'Connect to computer' })).toBeVisible();
});

test('a paired phone shows the same workspace through the native adapter', async ({
	page
}, testInfo) => {
	await remotePhoneFixture(page, 'online');
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Alpha', exact: true }).click();
	const pages = `/projects/${alpha}/harness/branch/feat%2Falpha`;
	await expect(page).toHaveURL(new RegExp(`${pages}/pages$`));
	await expect(page.getByLabel('Project', { exact: true })).toHaveValue(alpha);
	await expect(page.getByRole('button', { name: 'Add local project' })).toHaveCount(0);
	const categories = page.getByRole('navigation', { name: 'Catalog categories' });
	await expect(categories.getByRole('link', { name: 'Components', exact: true })).toHaveAttribute(
		'href',
		`${pages}/components`
	);
	await page.getByRole('link', { name: 'Review designs' }).click();
	const image = page.getByRole('img', { name: 'Alpha activity v002 desktop default' });
	await expect(image).toBeVisible();
	await expect
		.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
		.not.toBe(0);
	const reason = 'No verification recorded for this revision.';
	await expect(page.getByRole('button', { name: reason, exact: true }).first()).toHaveAttribute(
		'title',
		reason
	);
	const heading = await page.locator('.entity-heading').boundingBox();
	const summary = await page.locator('.entity-heading p').boundingBox();
	expect(summary!.width).toBeGreaterThanOrEqual(heading!.width * 0.9);
	for (const name of ['Details →', 'Conversation']) {
		const action = await page.getByRole('button', { name, exact: true }).boundingBox();
		expect(action!.y).toBeGreaterThanOrEqual(summary!.y + summary!.height);
	}
	await page.getByRole('button', { name: 'Conversation', exact: true }).click();
	const modes = page.getByRole('group', { name: 'Request mode' });
	await modes.getByRole('button', { name: 'Plan', exact: true }).click();
	await expect(page.getByLabel('Model', { exact: true }).locator('option')).toHaveText([
		'Fixture model'
	]);
	const asked = (await made(page, 'native.request')).map((call) => call.method);
	expect(asked).toEqual(expect.arrayContaining(['snapshot', 'entity', 'image', 'providers']));
	expect(asked).not.toContain('openProject');
	expect(asked).not.toContain('selectProject');
	expect(await fits(page)).toBe(true);
	await remoteEvidence(page, testInfo, 'phone-workspace');
});

test('a lost computer is an explicit read-only cached view, and a disconnect leaves nothing', async ({
	page
}, testInfo) => {
	await remotePhoneFixture(page, 'online');
	await page.goto(`/projects/${alpha}/harness/branch/feat%2Falpha/pages/page%3Aactivity`);
	await expect(page.getByRole('heading', { level: 1, name: 'Alpha activity' })).toBeVisible();
	await page.getByRole('button', { name: 'Conversation', exact: true }).click();
	await expect(message(page)).toBeEnabled();
	const footer = page.getByRole('contentinfo');
	const status = footer.getByRole('region', { name: 'Computer connection' });
	await expect(status).toContainText(`Connected to ${hostName}`);
	await announce(page, 'offline');
	await expect(footer.getByText('Offline cached view', { exact: true })).toBeVisible();
	await expect(status).toContainText('Computer offline');
	await expect(message(page)).toBeDisabled();
	await expect(page.getByRole('group', { name: 'Request mode' })).toHaveCount(0);
	await expect(page.getByText(/Comments and changes need a connection/)).toBeVisible();
	await remoteEvidence(page, testInfo, 'phone-offline');
	const before = (await made(page, 'native.request')).length;
	await announce(page, 'online');
	await expect(footer.getByText('Offline cached view', { exact: true })).toHaveCount(0);
	await expect(message(page)).toBeEnabled();
	expect((await made(page, 'native.request')).length).toBeGreaterThan(before);
	await page.getByRole('button', { name: 'Close conversation', exact: true }).click();
	await status.getByRole('button', { name: 'Disconnect', exact: true }).click();
	await expect(computer(page).getByRole('heading', { name: 'Connect to computer' })).toBeVisible();
	await expect(page.getByText(/Alpha/)).toHaveCount(0);
	await expect(page).toHaveURL(/\/$/);
});
