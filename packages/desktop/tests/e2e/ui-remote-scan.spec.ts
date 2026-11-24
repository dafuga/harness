import { expect, test } from '../../../../test/support/browserTest';
import { remoteEvidence } from './remote-evidence';
import { remotePhoneFixture } from './ui-remote-phone-fixture';

test.use({ viewport: { width: 390, height: 844 } });

test('the computer picker has no camera path even with a legacy native scanner', async ({
	page
}, testInfo) => {
	await remotePhoneFixture(page);
	await page.goto('/');
	const panel = page.getByRole('region', { name: 'Computer connection' });
	await expect(panel.getByRole('button', { name: 'Connect to Studio Mac' })).toBeVisible();
	await remoteEvidence(page, testInfo, 'phone-account-discovery');
	await expect(panel.getByText('Other connection options')).toHaveCount(0);
	await expect(panel.getByRole('button', { name: /scan|camera|QR code/i })).toHaveCount(0);
	const calls = await page.evaluate(
		() => (window as unknown as { __calls: { op: string }[] }).__calls
	);
	expect(calls.some(({ op }) => op === 'native.scan')).toBe(false);
});
