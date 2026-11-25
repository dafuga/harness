import { expect, test } from '../../../../test/support/browserTest';
import { captured } from './remote-evidence';
import { remotePhoneFixture } from './ui-remote-phone-fixture';

const viewports = [
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'tablet', width: 920, height: 1180 },
	{ name: 'phone', width: 390, height: 844 }
];

for (const { name, width, height } of viewports) {
	test(`a signed-in ${name} viewport opens account sessions while its Mac is offline`, async ({
		page
	}, info) => {
		await page.setViewportSize({ width, height });
		await remotePhoneFixture(page, 'offline', true);
		await page.goto('/');
		const entry = page.getByRole('link', { name: 'Sessions', exact: true });
		await captured(page, info, 'sessions-home');
		await expect(entry).toBeVisible();
		await entry.click();
		await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
		await expect(page.getByRole('status')).toHaveText('Offline · Showing saved sessions');
		await captured(page, info, 'sessions-list');
		await page.getByRole('button', { name: 'run-fixture' }).click();
		await expect(page.getByText('Saved session text', { exact: true })).toBeVisible();
		await expect(page.getByText('Live fixture output', { exact: true })).toBeVisible();
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
		await captured(page, info, 'sessions-detail');
	});
}
