import type { Call, Phone } from './ui-remote-phone.spec.types';
import { expect, test, type Page } from '../../../../test/support/browserTest';
import { captured, remoteEvidence } from './remote-evidence';
import { alpha, deviceName, hostName, remotePhoneFixture } from './ui-remote-phone-fixture';
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
const fits = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
test.use({ viewport: { width: 390, height: 844 } });

test('the signed-in iPhone shows both Macs without a scanner, code, or address', async ({
	page
}, testInfo) => {
	await remotePhoneFixture(page);
	await page.goto('/');
	const panel = computer(page);
	await expect(page.locator('html')).toHaveAttribute('data-environment', 'capacitor');
	await expect(panel.getByRole('button', { name: `Connect to ${hostName}` })).toBeVisible();
	await expect(panel.getByRole('button', { name: 'Connect to Studio Mac' })).toBeVisible();
	await remoteEvidence(page, testInfo, 'phone-start');
	await expect(page.getByText('Approve this device on your iPhone or Mac')).toBeVisible();
	await page.getByRole('button', { name: 'Devices', exact: true }).click();
	await expect.poll(() => made(page, 'native.sealedDevices')).toHaveLength(1);
	await expect(panel.getByText('Other connection options', { exact: true })).toHaveCount(0);
	await expect(panel.getByRole('textbox')).toHaveCount(0);
	await expect(panel.getByRole('button', { name: /Scan|QR code/ })).toHaveCount(0);
	await expect(projects(page)).toHaveCount(0);
	expect(await fits(page)).toBe(true);
});

test('a signed-in iPhone connects directly and shows the selected Mac’s projects', async ({
	page
}, testInfo) => {
	await remotePhoneFixture(page);
	await page.goto('/');
	const panel = computer(page);
	await expect(panel.getByRole('heading', { name: 'Connect to computer' })).toBeVisible();
	await remoteEvidence(page, testInfo, 'phone-account-discovery');
	await expect(panel.getByText('Other connection options', { exact: true })).toHaveCount(0);
	await panel.getByRole('button', { name: `Connect to ${hostName}`, exact: true }).click();
	await expect(panel.getByText(`Connecting to ${hostName}…`)).toBeVisible();
	await remoteEvidence(page, testInfo, 'phone-connecting');
	await expect(panel.getByText(/Waiting for approval/)).toHaveCount(0);
	await expect(projects(page)).toHaveCount(0);
	expect(await made(page, 'native.scan')).toEqual([]);
	expect(await made(page, 'native.connectAccountComputer')).toHaveLength(1);
	await announce(page, 'online');
	await expect(
		panel.getByRole('button', { name: `Connected to ${hostName}`, exact: true })
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open Alpha', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open Beta', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open Gamma', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Open project', exact: true })).toHaveCount(0);
	expect(await fits(page)).toBe(true);
	await announce(page, 'revoked');
	await expect(panel.getByText(/access was removed on the computer/)).toBeVisible();
	await expect(projects(page)).toHaveCount(0);
	await remoteEvidence(page, testInfo, 'phone-revoked');
	await panel.getByRole('button', { name: 'Back to computers', exact: true }).click();
	expect((await made(page, 'native.disconnect')).length).toBe(1);
	await expect(panel.getByRole('heading', { name: 'Connect to computer' })).toBeVisible();
	await panel.getByRole('button', { name: 'Connect to Studio Mac', exact: true }).click();
	await announce(page, 'online');
	await expect(panel.getByRole('button', { name: 'Connected to Studio Mac' })).toBeVisible();
});

for (const width of [320, 390]) {
	test.describe(`connected at ${width}px`, () => {
		test.use({ viewport: { width, height: 844 } });

		test('the projects come first; the details sit in one Connection dialog', async ({
			page
		}, testInfo) => {
			await remotePhoneFixture(page, 'pending-approval');
			await page.goto('/');
			await announce(page, 'online');
			const panel = computer(page);
			const chip = panel.getByRole('button', { name: `Connected to ${hostName}`, exact: true });
			await expect(chip).toBeVisible();
			await expect(projects(page).first()).toBeVisible();
			await expect(panel.getByRole('button', { name: 'Disconnect', exact: true })).toHaveCount(0);
			await expect(page.getByText(/^Key /)).toHaveCount(0);
			await expect(page.getByText(`This phone: ${deviceName}`)).toHaveCount(0);
			await expect(page.getByText('Signed in with Google')).toHaveCount(0);
			await expect(projects(page).first().locator('.recent-chevron')).toBeVisible();
			expect(await fits(page)).toBe(true);
			await remoteEvidence(page, testInfo, 'phone-connected');
			await chip.click();
			const dialog = page.getByRole('dialog', { name: 'Connection', exact: true });
			await expect(
				dialog.getByText(/Computer awake · works while its screen is locked/)
			).toBeVisible();
			await expect(dialog.getByText('2 projects · Plan and Change allowed')).toBeVisible();
			await expect(dialog.getByText(`This phone: ${deviceName}`)).toBeVisible();
			await expect(dialog.getByText(/^Key /)).toBeVisible();
			await expect(dialog.getByRole('button', { name: 'Disconnect', exact: true })).toBeVisible();
			await expect(dialog.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
			await expect(dialog.getByRole('button', { name: 'Devices', exact: true })).toBeVisible();
			expect(await fits(page)).toBe(true);
			await remoteEvidence(page, testInfo, 'phone-connection-dialog');
			await dialog.getByRole('button', { name: 'Disconnect', exact: true }).click();
			await expect(
				computer(page).getByRole('heading', { name: 'Connect to computer' })
			).toBeVisible();
		});
	});
}

test('a paired phone shows the same workspace through the native adapter', async ({
	page
}, testInfo) => {
	await remotePhoneFixture(page, 'online');
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Alpha', exact: true }).click();
	const pages = `/projects/${alpha}/harness/branch/feat%2Falpha`;
	await expect(page).toHaveURL(new RegExp(`${pages}/pages$`));
	await expect(page.locator('.project-name')).toHaveText('Alpha');
	await expect(page.getByRole('button', { name: 'Add local project' })).toHaveCount(0);
	const categories = page.getByRole('navigation', { name: 'Catalog categories' });
	await expect(categories.getByRole('link', { name: 'Components', exact: true })).toHaveAttribute(
		'href',
		`${pages}/components`
	);
	await page.getByRole('link', { name: 'Open Alpha activity' }).click();
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
	for (const name of ['Conversation']) {
		const action = await page.getByRole('button', { name, exact: true }).boundingBox();
		expect(action!.y).toBeGreaterThanOrEqual(summary!.y + summary!.height);
	}
	await page.getByRole('button', { name: 'Conversation', exact: true }).click();
	const modes = page.getByRole('group', { name: 'Request mode' });
	const plan = modes.getByRole('button', { name: 'Plan', exact: true });
	await plan.click();
	await captured(page, testInfo, `phone-plan-${process.env.SCREENSHOT_LABEL}`);
	await expect(plan).toHaveAttribute('aria-pressed', 'true');
	await expect(
		page.getByText('Sonnet mockups · Haiku sizes and states', { exact: true })
	).toBeVisible();
	await expect(page.getByLabel('Model', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Choose model', exact: true })).toHaveCount(0);
	const sendPlan = page.getByRole('button', { name: 'Send plan', exact: true });
	await expect(sendPlan).toBeDisabled();
	await message(page).fill('Try a more compact header');
	await expect(sendPlan).toBeEnabled();
	await message(page).clear();
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
