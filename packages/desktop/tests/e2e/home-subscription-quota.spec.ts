import { expect, test } from '../../../../test/support/browserTest';
import { captured } from './remote-evidence';
import { scenarioCapture } from './scenario-capture';
import { remotePhoneFixture } from './ui-remote-phone-fixture';
import type { ScenarioManifest } from '../../../../src/core/unitTypes';
import scenario from '../../../../specification/scenarios/desktop-subscription-quota.json' with { type: 'json' };

const note =
	'Compiled native Home inspected with synthetic subscription data and a renderer test bridge.';

for (const [width, height] of [
	[1440, 900],
	[820, 1180],
	[390, 844]
] as const) {
	test(`Mac Home shows subscription quota and reset times at ${width}px`, async ({
		page
	}, info) => {
		await page.setViewportSize({ width, height });
		await page.addInitScript(() => {
			Object.assign(window, {
				harness: {
					listProjects: async () => [],
					onRunEvent: () => () => {},
					homeSnapshot: async () => ({
						providers: {
							quota: [
								{
									id: 'claude',
									provider: 'claude',
									readAt: new Date().toISOString(),
									limits: [
										{
											id: '5h',
											label: '5-hour',
											left: 75,
											resetsAt: new Date(Date.now() + 3_600_000).toISOString()
										}
									],
									credits: null
								},
								{
									id: 'codex',
									provider: 'codex',
									readAt: new Date().toISOString(),
									limits: [{ id: 'weekly', label: 'Weekly', left: 24, resetsAt: null }],
									credits: '124'
								}
							]
						}
					})
				}
			});
		});
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Recent projects' })).toBeVisible();
		await captured(page, info, `${process.env.SCREENSHOT_LABEL}-home-${width}`);
		await page.getByRole('button', { name: 'Subscription quota', exact: true }).click();
		const dialog = page.getByRole('dialog', { name: 'Subscription quota' });
		await expect(dialog.getByText('Claude Code', { exact: true })).toBeVisible();
		await expect(dialog.getByText('5-hour · 75% left')).toBeVisible();
		await expect(dialog.getByText(/^Resets /)).toBeVisible();
		await expect(dialog.getByText('Weekly · 24% left')).toBeVisible();
		await expect(dialog.getByText('Credits left: 124')).toBeVisible();
		await captured(page, info, `${process.env.SCREENSHOT_LABEL}-quota-${width}`);
		await scenarioCapture(page, scenario as ScenarioManifest, {
			state: 'quota',
			name: 'dialog',
			note
		});
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await scenarioCapture(page, scenario as ScenarioManifest, {
			state: 'home',
			name: 'home',
			note
		});
	});
}

test('an iPhone only shows the quota offered by its currently linked Mac', async ({
	page
}, info) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await remotePhoneFixture(page, 'online', {
		providers: {
			quota: [
				{
					id: 'codex',
					provider: 'codex',
					readAt: new Date().toISOString(),
					limits: [{ id: 'weekly', label: 'Weekly', left: 24, resetsAt: null }],
					credits: '124'
				}
			]
		}
	});
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-environment', 'capacitor');
	await expect(page.getByRole('heading', { name: 'Recent projects' })).toBeVisible();
	await captured(page, info, `${process.env.SCREENSHOT_LABEL}-iphone-home`);
	await page.getByRole('button', { name: 'Subscription quota', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Subscription quota' });
	await expect(dialog.getByText('Weekly · 24% left')).toBeVisible();
	await expect(dialog.getByText('Credits left: 124')).toBeVisible();
	await expect(dialog.getByText('Claude Code quota is unknown.')).toBeVisible();
	await captured(page, info, `${process.env.SCREENSHOT_LABEL}-iphone-quota`);
	await scenarioCapture(page, scenario as ScenarioManifest, {
		state: 'phone-quota',
		name: 'dialog',
		note
	});
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await scenarioCapture(page, scenario as ScenarioManifest, {
		state: 'phone-home',
		name: 'home',
		note
	});
	await page.evaluate(() => {
		const phone = window as unknown as { __remotePhone: { set: (state: string) => void } };
		phone.__remotePhone.set('revoked');
	});
	await expect(page.getByRole('button', { name: 'Subscription quota', exact: true })).toHaveCount(
		0
	);
});
