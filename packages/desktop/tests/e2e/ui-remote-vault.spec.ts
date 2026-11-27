import type { Page } from '@playwright/test';
import { expect, test } from '../../../../test/support/browserTest';
import { captured } from './remote-evidence';
import { remotePhoneFixture } from './ui-remote-phone-fixture';
import type { PhoneHost } from './ui-remote-phone-fixture.types';

/** SYNTHETIC `HarnessVault` plugin: the first open fails, later ones are counted. */
function installVaultPlugin() {
	const { Capacitor, __calls: calls } = window as unknown as PhoneHost;
	Capacitor.PluginHeaders.push({
		name: 'HarnessVault',
		methods: [{ name: 'open', rtype: 'promise' }]
	});
	const other = Capacitor.nativePromise;
	Capacitor.nativePromise = async (plugin, method, input) => {
		if (plugin !== 'HarnessVault') return other(plugin, method, input);
		calls.push({ op: 'native.openVault' });
		if (calls.filter((call) => call.op === 'native.openVault').length === 1)
			throw new Error('The Vault needs iOS 17 or later.');
	};
}

const opened = (page: Page) =>
	page.evaluate(
		() =>
			(window as unknown as PhoneHost).__calls.filter((call) => call.op === 'native.openVault')
				.length
	);
const vault = (page: Page) => page.getByRole('button', { name: 'Vault', exact: true });
const ready = (page: Page) => page.getByRole('button', { name: 'Connect to Studio Mac' });
test.use({ viewport: { width: 390, height: 844 } });

test('a shell without the native Vault offers no Vault button', async ({ page }) => {
	await remotePhoneFixture(page);
	await page.goto('/');
	await expect(ready(page)).toBeVisible();
	await expect(vault(page)).toHaveCount(0);
});

test('the iPhone opens the native Vault and says why it could not', async ({ page }, testInfo) => {
	await remotePhoneFixture(page);
	await page.addInitScript(installVaultPlugin);
	await page.goto('/');
	await expect(ready(page)).toBeVisible();
	const box = (await vault(page).boundingBox())!;
	expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
	await captured(page, testInfo, 'phone-vault-entry', vault(page));
	await vault(page).click();
	await expect(page.getByRole('alert')).toHaveText('The Vault needs iOS 17 or later.');
	await captured(page, testInfo, 'phone-vault-refused', page.getByRole('alert'));
	await vault(page).click();
	await expect(page.getByRole('alert')).toHaveCount(0);
	expect(await opened(page)).toBe(2);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});
