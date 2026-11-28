import { expect, type Page, type TestInfo } from '../../../../test/support/browserTest';

export const sizes = {
	desktop: { width: 1440, height: 900 },
	tablet: { width: 820, height: 1180 },
	phone: { width: 390, height: 844 }
};

export async function shot(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = process.env.SCREENSHOT_DIR ?? 'test-results/web-push';
	await page.screenshot({ path: `${directory}/${name}.png`, animations: 'disabled' });
}

export async function open(page: Page, size: keyof typeof sizes, address = '/') {
	await page.setViewportSize(sizes[size]);
	await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
	await page.goto(address);
	await expect(page.getByRole('region', { name: 'Agents', exact: true })).toBeVisible();
}

export const row = (page: Page) => page.getByRole('group', { name: 'Notifications' });
export const shown = (page: Page, scope = '/') =>
	page.evaluate(async (scope) => {
		const registration = await navigator.serviceWorker.getRegistration(scope);
		return ((await registration?.getNotifications()) ?? []).map(({ title, body, tag, data }) => ({
			title,
			body,
			tag,
			data
		}));
	}, scope);

export async function captureDeviceApproval(page: Page, testInfo: TestInfo, state: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	for (const width of [390, 768, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		await page.evaluate(async () => {
			await document.fonts.ready;
			const visible = [...document.images].filter((image) => image.checkVisibility());
			await Promise.all(visible.map((image) => image.decode()));
		});
		await page.screenshot({ path: testInfo.outputPath(`hub-device-${state}-${width}.png`) });
	}
}
