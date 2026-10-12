import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
	deviceName,
	hostName,
	pairing,
	pairingLink,
	relayOrigin,
	remotePhoneFixture
} from './ui-remote-phone-fixture';

type Call = Record<string, unknown>;
type Listener = { eventName: string; callback: (value: unknown) => void };
type Phone = { __remotePhone: { listeners: Map<string, Listener> } };
/** Screenshots are opt-in test output; they are never part of the source tree. */
const shot = async (page: Page, info: TestInfo, name: string) => {
	if (process.env.TAKE_SCREENSHOT === 'true')
		await page.screenshot({ path: info.outputPath(`${name}.png`) });
};
const made = async (page: Page, op: string) =>
	(await page.evaluate(() => (window as unknown as { __calls: Call[] }).__calls)).filter(
		(call) => call.op === op
	);
/** What the native plugin announces when the phone is opened with a `harnessremote://` link. */
const opened = (page: Page, link: string) =>
	page.evaluate((value) => {
		const phone = (window as unknown as Phone).__remotePhone;
		phone.listeners.forEach((item) => {
			if (item.eventName === 'pairingLink') item.callback({ link: value });
		});
	}, link);
const computer = (page: Page) => page.getByRole('region', { name: 'Computer connection' });
const field = (page: Page, name: string) =>
	computer(page).getByRole('textbox', { name, exact: true });

test.use({ viewport: { width: 390, height: 844 } });

test('a pairing link the phone was opened with fills the form and still needs the typed code', async ({
	page
}, testInfo) => {
	await remotePhoneFixture(page);
	await page.goto('/');
	await shot(page, testInfo, 'links-start');
	const panel = computer(page);
	await expect(field(page, 'Pairing link')).toHaveValue('');
	const refused = [
		pairingLink.replace('https%3A', 'http%3A'),
		`${pairingLink}&code=${pairing.code}`,
		pairingLink.replace('harnessremote://pair?', 'harnessremote://open?')
	];
	for (const link of refused) await opened(page, link);
	await expect(field(page, 'Pairing link')).toHaveValue('');
	await opened(page, pairingLink);
	await expect(field(page, 'Pairing link')).toHaveValue(pairingLink);
	await expect(
		panel.getByText('Pairing link received. Type the code your computer shows.')
	).toBeVisible();
	await expect(field(page, 'Pairing code')).toHaveValue('');
	expect(await made(page, 'native.pair')).toEqual([]);
	expect(page.url()).not.toContain(pairing.hostId);
	await shot(page, testInfo, 'links-received');
	await field(page, 'Name of this phone').fill(deviceName);
	await field(page, 'Pairing code').fill('kq7m-2xwp');
	await panel.getByRole('button', { name: 'Connect', exact: true }).click();
	expect(await made(page, 'native.pair')).toEqual([
		{ op: 'native.pair', origin: relayOrigin, ...pairing, deviceName }
	]);
	await expect(panel.getByText(/Waiting for approval/)).toBeVisible();
});

test('a link that arrives while a computer is connected changes nothing', async ({ page }) => {
	await remotePhoneFixture(page, 'online');
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'Open Alpha', exact: true })).toBeVisible();
	await opened(page, pairingLink);
	await expect(computer(page).getByText(`Connected to ${hostName}`)).toBeVisible();
	await expect(field(page, 'Pairing link')).toHaveCount(0);
	expect(await made(page, 'native.pair')).toEqual([]);
	expect(await made(page, 'native.disconnect')).toEqual([]);
	await expect(page.getByRole('button', { name: 'Open Alpha', exact: true })).toBeVisible();
});
