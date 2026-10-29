import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test, expect } from '../../../../test/support/browserTest';
import { seededId } from './support/fixtures';
import { reportView } from './support/portableReport';

// The design screenshots of StatusBadge, captured from the seeded report that renders it.
const designs = resolve(
	'../../specification/designs/harness-reports/components/status-badge/designs/v001'
);
const sizes = [
	['desktop', 1440],
	['tablet', 920],
	['mobile', 390]
] as const;

for (const [name, width] of sizes)
	test(`status badge design screenshot at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 1000 });
		await page.goto(await reportView(await seededId()));
		await page.waitForLoadState('networkidle');
		const badge = page.locator('.badge').first();
		await expect(badge).toBeVisible();
		await expect(badge).toHaveText(/\S/);
		await page.evaluate(() => document.fonts.ready);
		await mkdir(designs, { recursive: true });
		await badge.screenshot({ path: `${designs}/${name}.png`, animations: 'disabled' });
	});
