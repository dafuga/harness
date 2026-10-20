import { expect, test } from '../../../../test/support/browserTest';
import { mkdirSync } from 'node:fs';
import { projectFixture, alpha } from './ui-project-fixture';
import type { ScenarioManifest } from '../../../../src/core/unitTypes';
import scenario from '../../../../specification/scenarios/desktop-renderer.json' with { type: 'json' };
import { scenarioCapture } from './scenario-capture';

for (const width of [1440, 920, 390]) {
	test(`app navigation stays at the top while scrolling at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await projectFixture(page);
		await page.addInitScript(() => {
			const host = window as unknown as {
				__projects: { data: { projects: Array<{ entities: Array<Record<string, unknown>> }> } };
			};
			const project = host.__projects.data.projects[0];
			const component = project.entities.find((item) => item.category === 'components')!;
			project.entities = Array.from({ length: 24 }, (_, index) => ({
				...component,
				id: `component:nav-${index}`,
				title: `Navigation fixture ${String(index).padStart(2, '0')}`
			}));
		});
		await page.goto(`/projects/${alpha}/harness/branch/feat%2Falpha/components`);
		const nav = page.getByRole('banner');
		const heading = page.getByRole('heading', { name: 'Components', exact: true, level: 1 });
		await expect(heading).toBeVisible();
		const initialNav = await nav.boundingBox();
		const initialHeading = await heading.boundingBox();
		expect(initialHeading!.y).toBeGreaterThanOrEqual(initialNav!.y + initialNav!.height);
		await page.evaluate(() => window.scrollTo(0, 1000));
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(900);
		await page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all([...document.images].map((image) => image.decode()));
		});
		await page.mouse.move(0, 0);
		if (process.env.TAKE_SCREENSHOT === 'true') {
			mkdirSync('/tmp/fixed-navigation-evidence', { recursive: true });
			await page.screenshot({
				path: `/tmp/fixed-navigation-evidence/${process.env.SCREENSHOT_LABEL}-${width}.png`
			});
		}
		expect((await nav.boundingBox())!.y).toBeCloseTo(0, 1);
		await expect(nav).toBeInViewport();
		await scenarioCapture(page, scenario as ScenarioManifest, {
			state: 'fixed-navigation',
			name: `scrolled-${width}`,
			note: 'Actual compiled renderer scrolled 1000 px over a SYNTHETIC project of 24 components.'
		});
		await nav.getByRole('link', { name: 'Helpers', exact: true }).click();
		await expect(
			page.getByRole('heading', { name: 'Helpers', exact: true, level: 1 })
		).toBeInViewport();
	});
}
