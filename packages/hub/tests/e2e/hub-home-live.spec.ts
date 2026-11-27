import { expect, test } from '../../../../test/support/browserTest';
import { hubHomeFixture } from './hub-home-fixture';
import { linkedComputersFixture } from './linked-computers-fixture';

test.setTimeout(90000);

test('a signed-in account sees its linked Mac streaming sessions without connecting anything', async ({
	page
}) => {
	const { snapshot } = await hubHomeFixture(page, 'default');
	// No owner snapshot is stored for this account: only the Mac, over the encrypted channel, knows.
	await page.route('**/api/hub-home', (route) =>
		route.fulfill({ json: { granted: false, snapshot: null } })
	);
	await linkedComputersFixture(page, snapshot);
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/running.*, .* need[s]? you/);
	await expect(page.getByText('Connect your Mac')).toHaveCount(0);
	await expect(page.getByText('Connect a computer')).toHaveCount(0);
	await expect(page.locator('.hh-agent-list li').first()).toBeVisible();
	await expect(
		page
			.getByRole('region', { name: 'Agents', exact: true })
			.getByText('1 working (3 sessions) · 0 idle or offline', { exact: true })
	).toBeVisible();
	await expect(page.getByText('Unknown')).toHaveCount(0);
	if (process.env.TAKE_SCREENSHOT)
		await page.screenshot({ path: test.info().outputPath('live-home.png'), fullPage: true });
});

test('with no Mac linked and nothing stored, Home asks to connect a Mac as the fallback', async ({
	page
}) => {
	await hubHomeFixture(page, 'default');
	await page.route('**/api/hub-home', (route) =>
		route.fulfill({ json: { granted: false, snapshot: null } })
	);
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Connect your Mac');
});
