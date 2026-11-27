import type { Call } from './ui-remote-host.spec.types';
import { expect, test, type Page } from '../../../../test/support/browserTest';
import { captured, remoteEvidence } from './remote-evidence';
import { alpha, gamma, phone, remoteHostFixture } from './ui-remote-host-fixture';
const made = async (page: Page, op: string) =>
	(await page.evaluate(() => (window as unknown as { __calls: Call[] }).__calls)).filter(
		(call) => call.op === op
	);
const access = (page: Page) => page.getByRole('region', { name: 'Linked devices' });
/** The home keeps phone access behind its quiet hint: the settings open in a dialog. */
const home = async (page: Page) => {
	await page.goto('/');
	await expect(page.getByText(/sign in with the same Google account/)).toBeVisible();
	await expect(access(page)).toHaveCount(0);
	await page.getByRole('button', { name: 'Linked devices', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'Linked devices' })).toBeVisible();
	return access(page);
};
const computer = (page: Page) => page.getByRole('region', { name: 'Computer connection' });
const entity = (project: string, branch: string) =>
	`/projects/${project}/harness/branch/${branch}/pages/page%3Aactivity`;

test('the Electron environment manages a linked Mac without pairing controls', async ({
	page
}, testInfo) => {
	await remoteHostFixture(page, true);
	const panel = await home(page);
	await expect(page.locator('html')).toHaveAttribute('data-environment', 'electron');
	await expect(page.getByRole('button', { name: 'Open project', exact: true })).toBeEnabled();
	await expect(computer(page)).toHaveCount(0);
	await expect(panel.getByText('This Mac is linked · relay.example.invalid')).toBeVisible();
	await expect(panel.getByText(/keep working while this Mac is locked and awake/)).toBeVisible();
	await remoteEvidence(page, testInfo, 'desktop-access');
	await expect(panel.getByRole('button', { name: 'Pair a phone' })).toHaveCount(0);
	await expect(panel.getByRole('img', { name: 'Pairing QR code' })).toHaveCount(0);
	await panel.getByRole('button', { name: 'Unlink this Mac' }).click();
	await expect(panel.getByText('This Mac is unlinked.')).toBeVisible();
	await remoteEvidence(page, testInfo, 'desktop-start');
	await panel.getByRole('button', { name: 'Link this Mac' }).click();
	await expect(panel.getByText('This Mac is linked · relay.example.invalid')).toBeVisible();
	expect(await made(page, 'remote.enable')).toHaveLength(1);
	expect(await made(page, 'remote.disable')).toHaveLength(1);
});

test('linked devices are listed in settings and revoking one removes its access', async ({
	page
}, testInfo) => {
	await remoteHostFixture(page, true);
	const panel = await home(page);
	await page.evaluate(() =>
		(window as unknown as { __remoteHost: { request: () => void } }).__remoteHost.request()
	);
	const devices = panel.getByRole('list', { name: 'Connected devices' });
	const item = devices.getByRole('listitem').filter({ hasText: phone.name });
	await expect(item.getByText('Alpha', { exact: true })).toBeVisible();
	await expect(item.getByText('Read only', { exact: true })).toBeVisible();
	await expect(item.getByText('Connected', { exact: true })).toBeVisible();
	await remoteEvidence(page, testInfo, 'desktop-linked-device');
	await item.getByRole('button', { name: `Revoke ${phone.name}`, exact: true }).click();
	expect(await made(page, 'remote.revokeDevice')).toEqual([
		{ op: 'remote.revokeDevice', deviceId: phone.deviceId }
	]);
	await expect(panel.getByText('No devices have connected.')).toBeVisible();
	await expect(devices).toHaveCount(0);
});

test('phone access stays reachable in the workspace, and a hosted project offers no agent', async ({
	page
}, testInfo) => {
	await remoteHostFixture(page, true);
	await page.goto(entity(alpha, 'feat%2Falpha'));
	await expect(page.getByRole('heading', { level: 1, name: 'Alpha activity' })).toBeVisible();
	const footer = page.getByRole('contentinfo');
	await expect(footer.getByRole('region', { name: 'Linked devices' })).toContainText('Mac linked');
	await expect(footer.getByRole('button', { name: 'Pair a phone', exact: true })).toHaveCount(0);
	await footer.getByRole('button', { name: 'Manage linked devices', exact: true }).click();
	await expect(footer.getByRole('button', { name: 'Unlink this Mac', exact: true })).toBeVisible();
	const modes = page.getByRole('group', { name: 'Request mode' });
	const plan = modes.getByRole('button', { name: 'Plan', exact: true });
	await plan.click();
	await captured(page, testInfo, `host-plan-${process.env.SCREENSHOT_LABEL}`);
	await expect(plan).toHaveAttribute('aria-pressed', 'true');
	await expect(
		page.getByText('Sonnet mockups · Haiku sizes and states', { exact: true })
	).toBeVisible();
	await expect(page.getByLabel('Model', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Choose model', exact: true })).toHaveCount(0);
	const sendPlan = page.getByRole('button', { name: 'Send plan', exact: true });
	await expect(sendPlan).toBeDisabled();
	await page
		.getByRole('textbox', { name: 'Message', exact: true })
		.fill('Try a more compact header');
	await expect(sendPlan).toBeEnabled();
	await expect.poll(async () => (await made(page, 'providers')).length).toBeGreaterThan(0);
	await page.goto(entity(gamma, 'main'));
	await expect(page.getByRole('heading', { level: 1, name: 'Gamma activity' })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeEnabled();
	await expect(modes).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Choose model', exact: true })).toHaveCount(0);
	await expect(page.getByLabel('Model', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Change', exact: true })).toHaveCount(0);
});

test('an ordinary page selects the web environment and has neither connection', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-environment', 'web');
	await expect(page.getByText(/Browser preview · read-only\./)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open project', exact: true })).toBeDisabled();
	await expect(access(page)).toHaveCount(0);
	await expect(computer(page)).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Shared projects' })).toHaveCount(0);
});
