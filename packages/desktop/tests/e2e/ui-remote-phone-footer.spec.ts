import { expect, test, type Page } from '../../../../test/support/browserTest';
import { remoteEvidence } from './remote-evidence';
import { alpha, deviceName, hostName, remotePhoneFixture } from './ui-remote-phone-fixture';

const fits = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.use({ viewport: { width: 390, height: 844 } });

test('a paired workspace has one status line with one Disconnect and never says Local project', async ({
	page
}, testInfo) => {
	await remotePhoneFixture(page, 'online');
	await page.goto(`/projects/${alpha}/harness/branch/feat%2Falpha/pages/page%3Aactivity`);
	await expect(page.getByRole('heading', { level: 1, name: 'Alpha activity' })).toBeVisible();
	const footer = page.getByRole('contentinfo');
	const status = footer.getByRole('region', { name: 'Computer connection' });
	await expect(status).toContainText(`Connected to ${hostName} · ${deviceName}`);
	await expect(footer.getByRole('region', { name: 'Shared projects' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Disconnect', exact: true })).toHaveCount(1);
	await expect(page.getByText('Local project', { exact: true })).toHaveCount(0);
	expect(await fits(page)).toBe(true);
	await remoteEvidence(page, testInfo, 'phone-workspace-footer');
});
