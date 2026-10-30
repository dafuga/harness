import { expect, type Locator } from '@playwright/test';

/** Focus or hover the actual recorded source link. */
export async function preparePlatformDetails(component: Locator, variant: string) {
	const source = component.getByRole('link', { name: 'wrangler.jsonc' });
	if (variant === 'source-focused') await source.focus();
	if (variant === 'source-hovered') await source.hover();
}

/** Each platform detail retains its actual status, configuration or absence. */
export async function assertPlatformDetails(component: Locator, variant: string) {
	const words: Record<string, string> = {
		'': 'orders-web',
		ios: 'com.example.orders',
		android: 'No deployment settings are declared for Android.',
		desktop: 'com.example.orders.desktop',
		unrecorded: 'Nothing from another revision is shown in its place.',
		unindexed: 'Nothing from another revision is shown in its place.',
		gap: 'Deployment manifest is unavailable at this revision.',
		'not-found': 'Platform not found',
		'source-unavailable': 'GitHub links are unavailable here',
		'no-commands': 'orders-web',
		'no-requirements': 'orders-web',
		'no-sources': 'orders-web',
		'source-focused': 'wrangler.jsonc',
		'source-hovered': 'wrangler.jsonc'
	};
	await expect(component).toContainText(words[variant]);
	const omitted: Record<string, string> = {
		'no-commands': 'Commands',
		'no-requirements': 'Release requirements',
		'no-sources': 'Configuration sources'
	};
	if (omitted[variant])
		await expect(component.getByRole('heading', { name: omitted[variant] })).toHaveCount(0);
	if (variant === 'source-focused')
		expect(
			await component
				.getByRole('link', { name: 'wrangler.jsonc' })
				.evaluate((node) => node.matches(':focus-visible'))
		).toBe(true);
	if (variant === 'source-hovered')
		expect(
			await component
				.getByRole('link', { name: 'wrangler.jsonc' })
				.evaluate((node) => node.matches(':hover'))
		).toBe(true);
}
