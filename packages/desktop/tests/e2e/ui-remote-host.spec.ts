import { expect, test, type Page } from '@playwright/test';
import { remoteEvidence } from './remote-evidence';
import {
	alpha,
	gamma,
	pairing,
	pairingLink,
	phone,
	remoteHostFixture,
	shownCode
} from './ui-remote-host-fixture';

type Call = Record<string, unknown>;
const made = async (page: Page, op: string) =>
	(await page.evaluate(() => (window as unknown as { __calls: Call[] }).__calls)).filter(
		(call) => call.op === op
	);
const access = (page: Page) => page.getByRole('region', { name: 'Phone access' });
const computer = (page: Page) => page.getByRole('region', { name: 'Computer connection' });
const entity = (project: string, branch: string) =>
	`/projects/${project}/harness/branch/${branch}/pages/page%3Aactivity`;

test('the Electron environment turns phone access on and offers a one-time pairing', async ({
	page
}, testInfo) => {
	await remoteHostFixture(page);
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-environment', 'electron');
	await expect(page.getByRole('button', { name: 'Open Project', exact: true })).toBeEnabled();
	await expect(computer(page)).toHaveCount(0);
	const panel = access(page);
	await expect(panel.getByText('Phone access is off.')).toBeVisible();
	await expect(page.getByRole('textbox')).toHaveCount(0);
	await remoteEvidence(page, testInfo, 'desktop-start');
	await panel.getByRole('button', { name: 'Turn on phone access', exact: true }).click();
	await expect(panel.getByText('Phone access is on · relay.example.invalid')).toBeVisible();
	await expect(panel.getByText(/keep working while this Mac is locked and awake/)).toBeVisible();
	await expect(panel.getByText('No phone is approved.')).toBeVisible();
	await panel.getByRole('button', { name: 'Pair a phone', exact: true }).click();
	await expect(panel.getByText(shownCode, { exact: true })).toBeVisible();
	await expect(panel.getByText(pairingLink, { exact: true })).toBeVisible();
	await expect(page.getByText(/secret|token|private key|credential/i)).toHaveCount(0);
	expect(page.url()).not.toContain(pairing.code);
	await remoteEvidence(page, testInfo, 'desktop-access');
	await panel.getByRole('button', { name: 'Turn off phone access', exact: true }).click();
	await expect(panel.getByText('Phone access is off.')).toBeVisible();
	await expect(panel.getByText(shownCode, { exact: true })).toHaveCount(0);
	expect((await made(page, 'remote.enable')).length).toBe(1);
	expect((await made(page, 'remote.disable')).length).toBe(1);
});

test('a phone is approved on the desktop for chosen local projects, and can be revoked', async ({
	page
}, testInfo) => {
	await remoteHostFixture(page, true);
	await page.goto('/');
	const panel = access(page);
	await panel.getByRole('button', { name: 'Pair a phone', exact: true }).click();
	await page.evaluate(() =>
		(window as unknown as { __remoteHost: { request: () => void } }).__remoteHost.request()
	);
	const request = panel.getByRole('group', { name: `${phone.name} asks to connect` });
	await expect(request.getByText(phone.fingerprint)).toBeVisible();
	const approve = request.getByRole('button', { name: 'Approve', exact: true });
	await expect(approve).toBeDisabled();
	await expect(request.getByRole('button', { name: 'Decline', exact: true })).toBeEnabled();
	await expect(request.getByRole('checkbox', { name: 'Beta', exact: true })).toBeVisible();
	await expect(request.getByRole('checkbox', { name: 'Gamma', exact: true })).toHaveCount(0);
	const agents = request.getByRole('checkbox', { name: 'May run Plan and Change agents' });
	await expect(agents).not.toBeChecked();
	await request.getByRole('checkbox', { name: 'Alpha', exact: true }).check();
	await remoteEvidence(page, testInfo, 'desktop-approval');
	await approve.click();
	expect(await made(page, 'remote.approvePairing')).toEqual([
		{
			op: 'remote.approvePairing',
			pairingId: pairing.pairingId,
			deviceId: phone.deviceId,
			projectIds: [alpha],
			agents: false
		}
	]);
	const phones = panel.getByRole('list', { name: 'Approved phones' });
	const item = phones.getByRole('listitem').filter({ hasText: phone.name });
	await expect(item.getByText('Alpha', { exact: true })).toBeVisible();
	await expect(item.getByText('Read and comment only')).toBeVisible();
	await expect(item.getByText('Connected', { exact: true })).toBeVisible();
	await expect(panel.getByText(shownCode, { exact: true })).toHaveCount(0);
	await item.getByRole('button', { name: `Revoke ${phone.name}`, exact: true }).click();
	expect(await made(page, 'remote.revokeDevice')).toEqual([
		{ op: 'remote.revokeDevice', deviceId: phone.deviceId }
	]);
	await expect(panel.getByText('No phone is approved.')).toBeVisible();
	await expect(phones).toHaveCount(0);
});

test('phone access stays reachable in the workspace, and a hosted project offers no agent', async ({
	page
}) => {
	await remoteHostFixture(page, true);
	await page.goto(entity(alpha, 'feat%2Falpha'));
	await expect(page.getByRole('heading', { level: 1, name: 'Alpha activity' })).toBeVisible();
	const footer = page.getByRole('contentinfo');
	await expect(footer.getByRole('region', { name: 'Phone access' })).toContainText(
		'Phone access on'
	);
	await expect(footer.getByRole('button', { name: 'Pair a phone', exact: true })).toHaveCount(0);
	await footer.getByRole('button', { name: 'Manage phone access', exact: true }).click();
	await expect(footer.getByRole('button', { name: 'Pair a phone', exact: true })).toBeVisible();
	const modes = page.getByRole('group', { name: 'Request mode' });
	await modes.getByRole('button', { name: 'Plan', exact: true }).click();
	await expect(page.getByLabel('Model', { exact: true }).locator('option')).toHaveText([
		'Fixture model'
	]);
	await page.goto(entity(gamma, 'main'));
	await expect(page.getByRole('heading', { level: 1, name: 'Gamma activity' })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeEnabled();
	await expect(modes).toHaveCount(0);
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
	await expect(page.getByRole('button', { name: 'Open Project', exact: true })).toBeDisabled();
	await expect(access(page)).toHaveCount(0);
	await expect(computer(page)).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Shared projects' })).toHaveCount(0);
});
