import { expect, test } from '@playwright/test';
import { agentSettingsFixture, openAgent } from './agent-settings-fixture';

for (const width of [1440, 390]) {
	for (const [label, maxWidth, maxHeight] of [
		['Choose model', 320, 480],
		['Reasoning effort', 220, 420]
	] as const) {
		test(`${label} preserves focus, dismissal and bounds at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await agentSettingsFixture(page);
			const panel = await openAgent(page);
			const trigger = panel.getByRole('button', { name: label, exact: true });
			const dialog = page.getByRole('dialog', { name: label, exact: true });
			await trigger.press('Enter');
			await expect(dialog.getByRole('button', { pressed: true })).toBeFocused();
			const bounds = (await dialog.boundingBox())!;
			expect(bounds.width).toBeLessThanOrEqual(maxWidth);
			expect(bounds.height).toBeLessThanOrEqual(maxHeight);
			expect(bounds.x).toBeGreaterThanOrEqual(0);
			expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
			await page.keyboard.press('Escape');
			await expect(dialog).not.toBeVisible();
			await expect(trigger).toBeFocused();
			await expect(panel).toBeVisible();
			await trigger.press('Enter');
			await expect(dialog).toBeVisible();
			await page.mouse.click(2, 2);
			await expect(dialog).not.toBeVisible();
			await expect(trigger).toBeFocused();
			await expect(panel).toBeVisible();
			await page.mouse.move(0, 0);
		});
	}
}
