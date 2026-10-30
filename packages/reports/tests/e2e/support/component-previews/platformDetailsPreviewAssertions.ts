import { expect, type Locator } from '@playwright/test';

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
		'source-unavailable': 'GitHub links are unavailable here'
	};
	await expect(component).toContainText(words[variant]);
}
