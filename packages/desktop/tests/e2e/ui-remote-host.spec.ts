import { expect, test, type Page } from '../../../../test/support/browserTest';
import { scannedText } from './qr-read';
import { captured, remoteEvidence } from './remote-evidence';
import {
	alpha,
	gamma,
	laterPairings,
	pairing,
	phone,
	relayOrigin,
	remoteHostFixture
} from './ui-remote-host-fixture';

type Call = Record<string, unknown>;
const made = async (page: Page, op: string) =>
	(await page.evaluate(() => (window as unknown as { __calls: Call[] }).__calls)).filter(
		(call) => call.op === op
	);
const access = (page: Page) => page.getByRole('region', { name: 'Phone access' });
const computer = (page: Page) => page.getByRole('region', { name: 'Computer connection' });
const code = (page: Page) => access(page).getByRole('img', { name: 'Pairing QR code' });
/** The text of the offer the SYNTHETIC control port holds open, or null when it holds none. */
const open = (page: Page) =>
	page.evaluate(() => {
		type Held = { __remoteHost: { status: { pairing: { scan: string } | null } } };
		return (window as unknown as Held).__remoteHost.status.pairing?.scan ?? null;
	});
const entity = (project: string, branch: string) =>
	`/projects/${project}/harness/branch/${branch}/pages/page%3Aactivity`;

test('the Electron environment turns phone access on and shows a one-time pairing as a QR code', async ({
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
	await expect.poll(() => open(page)).not.toBeNull();
	await captured(page, testInfo, 'desktop-pairing-offer', panel);
	await expect(code(page)).toBeVisible();
	const first = await scannedText(code(page));
	expect(first).toBe(await open(page));
	expect(first).toContain(
		`pairing=${pairing.pairingId};code=${pairing.code};origin=${relayOrigin}`
	);
	await expect(panel.getByText(/^Expires in [0-4]:[0-5]\d$/)).toBeVisible();
	await expect(page.getByRole('textbox')).toHaveCount(0);
	for (const hidden of ['KQ7M', 'harness-pair', pairing.pairingId])
		await expect(panel.getByText(hidden)).toHaveCount(0);
	await expect(page.getByText(/secret|token|private key|credential/i)).toHaveCount(0);
	expect(page.url()).not.toContain(pairing.code);
	await panel.scrollIntoViewIfNeeded();
	await remoteEvidence(page, testInfo, 'desktop-access');
	await panel.getByRole('button', { name: 'New code', exact: true }).click();
	await expect.poll(() => scannedText(code(page))).toContain(`pairing=${laterPairings[0]};`);
	expect(await scannedText(code(page))).toBe(await open(page));
	expect((await made(page, 'remote.createPairing')).length).toBe(2);
	await panel.getByRole('button', { name: 'Hide code', exact: true }).click();
	await expect(code(page)).toHaveCount(0);
	expect((await made(page, 'remote.closePairing')).length).toBe(1);
	await expect(panel.getByRole('button', { name: 'Pair a phone', exact: true })).toBeVisible();
	await expect(panel.getByRole('button', { name: 'New code', exact: true })).toHaveCount(0);
	await panel.scrollIntoViewIfNeeded();
	await remoteEvidence(page, testInfo, 'desktop-code-hidden');
	await panel.getByRole('button', { name: 'Pair a phone', exact: true }).click();
	await expect(code(page)).toBeVisible();
	await panel.getByRole('button', { name: 'Turn off phone access', exact: true }).click();
	await expect(panel.getByText('Phone access is off.')).toBeVisible();
	await expect(code(page)).toHaveCount(0);
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
	await captured(page, testInfo, 'desktop-request', request);
	await expect(code(page)).toHaveCount(0);
	const approve = request.getByRole('button', { name: 'Approve', exact: true });
	await expect(approve).toBeDisabled();
	await expect(request.getByRole('button', { name: 'Deny', exact: true })).toBeEnabled();
	await expect(request.getByRole('checkbox', { name: 'Beta', exact: true })).toBeVisible();
	await expect(request.getByRole('checkbox', { name: 'Gamma', exact: true })).toHaveCount(0);
	const deviceAccess = request.getByRole('combobox', { name: 'Device access', exact: true });
	await expect(deviceAccess).toHaveValue('comment');
	await expect(deviceAccess.getByRole('option')).toHaveText([
		'Read · browse only',
		'Comment · read and comment',
		'Write · read, comment and ask AI'
	]);
	await request.getByRole('checkbox', { name: 'Alpha', exact: true }).check();
	await request.scrollIntoViewIfNeeded();
	await remoteEvidence(page, testInfo, 'desktop-approval');
	await approve.click();
	expect(await made(page, 'remote.approvePairing')).toEqual([
		{
			op: 'remote.approvePairing',
			pairingId: pairing.pairingId,
			deviceId: phone.deviceId,
			projectIds: [alpha],
			agents: false,
			comments: true
		}
	]);
	const phones = panel.getByRole('list', { name: 'Approved phones' });
	const item = phones.getByRole('listitem').filter({ hasText: phone.name });
	await expect(item.getByText('Alpha', { exact: true })).toBeVisible();
	await expect(item.getByText('Comment · read and comment')).toBeVisible();
	await expect(item.getByText('Connected', { exact: true })).toBeVisible();
	await expect(code(page)).toHaveCount(0);
	await item.getByRole('button', { name: `Revoke ${phone.name}`, exact: true }).click();
	expect(await made(page, 'remote.revokeDevice')).toEqual([
		{ op: 'remote.revokeDevice', deviceId: phone.deviceId }
	]);
	await expect(panel.getByText('No phone is approved.')).toBeVisible();
	await expect(phones).toHaveCount(0);
});

test('a phone that is denied is not approved, and a code that ran out is no longer shown', async ({
	page
}, testInfo) => {
	await remoteHostFixture(page, true, 2500);
	await page.goto('/');
	const panel = access(page);
	const pair = panel.getByRole('button', { name: 'Pair a phone', exact: true });
	await pair.click();
	await expect(code(page)).toBeVisible();
	await page.evaluate(() =>
		(window as unknown as { __remoteHost: { request: () => void } }).__remoteHost.request()
	);
	const request = panel.getByRole('group', { name: `${phone.name} asks to connect` });
	await request.getByRole('button', { name: 'Deny', exact: true }).click();
	expect(await made(page, 'remote.denyPairing')).toEqual([
		{ op: 'remote.denyPairing', pairingId: pairing.pairingId }
	]);
	await expect(request).toHaveCount(0);
	await expect(code(page)).toHaveCount(0);
	await expect(panel.getByText('No phone is approved.')).toBeVisible();
	expect(await made(page, 'remote.approvePairing')).toEqual([]);
	await pair.click();
	await expect(code(page)).toBeVisible();
	await expect(panel.getByText('This code has expired.')).toBeVisible({ timeout: 8000 });
	await expect(code(page)).toHaveCount(0);
	await expect(panel.getByRole('button', { name: 'Hide code', exact: true })).toHaveCount(0);
	await panel.scrollIntoViewIfNeeded();
	await remoteEvidence(page, testInfo, 'desktop-code-expired');
	await panel.getByRole('button', { name: 'New code', exact: true }).click();
	await expect(code(page)).toBeVisible();
	expect(await scannedText(code(page))).toContain(`pairing=${laterPairings[1]};`);
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
