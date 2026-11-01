import { expect, type Locator, type Page } from '@playwright/test';
import { previewImages } from './imageZoomActions';
import { settlePreviewAudio } from './audioPreviewReadiness';

/** Loading states are accepted only for the two previews that request them. */
export async function assertPreviewLoading(content: Locator, id: string, variant: string) {
	if (id === 'desktop.component.runtime-artifact' && variant === 'loading') {
		await expect(content).toContainText('Reading what it holds…');
		return;
	}
	if (id === 'reports.component.harness-entity-artifact' && variant === 'loading')
		return await expect(content).toContainText('Reading what it holds…');
	if (
		['desktop.component.runtime-behavior', 'reports.component.harness-entity-behavior'].includes(
			id
		) &&
		variant === 'loading'
	)
		return await expect(content).toContainText('Reading the recorded results…');
	if (id === 'reports.component.harness-harness-console' && variant.startsWith('loading-'))
		return await expect(content).toContainText(
			variant === 'loading-history' ? 'Loading history…' : 'Loading this revision…'
		);
	const loading: Record<string, string> = {
		'reports.component.analytics-cpu': 'Sampling CPU…',
		'reports.component.gameplay-replay': 'Loading screenshot…',
		'reports.component.entity-states': 'Loading recorded capture…'
	};
	if (variant === 'loading' && loading[id]) return await expect(content).toContainText(loading[id]);
	await expect(content).not.toContainText(
		/Reading what it holds…|Reading the capture…|Loading screenshot…|Loading recorded activity…|Loading history…|Loading this revision…|Sampling CPU…|Checking sign-in…|Reading the request…/
	);
	if (id === 'reports.component.entity-states')
		await expect(content).not.toContainText('Loading recorded capture…');
}

export function previewWaitUntil(id: string, variant: string) {
	return ['reports.component.image-zoom', 'reports.component.gameplay-replay'].includes(id) &&
		variant === 'loading'
		? 'domcontentloaded'
		: 'load';
}

/** Expected gaps are explicit; other unavailable content must not become a capture. */
export async function assertPreviewMessages(content: Locator, id: string, variant: string) {
	const moduleCard = id === 'reports.component.explorer-ui-explorer-module-card';
	if (moduleCard && variant === 'image-error')
		await expect(content.locator('.ex-thumb-gap')).toBeVisible();
	if (
		id === 'reports.component.harness-entity-artifact' &&
		['unverified', 'lost'].includes(variant)
	)
		return;
	await expect(content).not.toContainText(
		/This project could not be opened|Design preview unavailable|Preview unavailable|Screenshot unavailable|not listed by the evidence|Not verified|Reading the clip…|TypeError:|ReferenceError:|Checking the GitHub connection…/
	);
	if (`${id}:${variant}` !== 'desktop.component.project-switcher:busy')
		await expect(content).not.toContainText(/Loading projects?…/);
	if (
		!(moduleCard && ['missing', 'page-missing', 'layout-missing', 'image-error'].includes(variant))
	)
		await expect(content).not.toContainText(/No screenshot (?:is )?recorded/);
	const expected: Record<string, string[]> = {
		'desktop.component.runtime-evidence': ['error'],
		'desktop.component.runtime-behavior': ['unreadable'],
		'reports.component.explorer-ui-explorer-kit-notice': ['', 'long'],
		'reports.component.activity-agents': ['failed-read', 'unreadable'],
		'reports.component.project-activity': ['failed-read'],
		'reports.component.explorer-dependencies-screen': ['partial', 'unreadable'],
		'reports.component.explorer-ui-explorer-translations-screen': ['gaps', 'gaps-open']
	};
	if (!(expected[id] ?? []).includes(variant))
		await expect(content).not.toContainText('could not be read');
}

/** Decode every expected image and settle fonts before framing the actual component. */
export async function settlePreviewImages(
	page: Page,
	content: Locator,
	id: string,
	variant: string
) {
	await settlePreviewAudio(content, id, variant);
	for (const img of await previewImages(content, id, variant)) {
		await img.scrollIntoViewIfNeeded();
		await expect
			.poll(() =>
				img.evaluate(
					(node: HTMLImageElement) =>
						node.complete && node.naturalWidth > 0 && node.naturalHeight > 0
				)
			)
			.toBe(true);
		await img.evaluate((node: HTMLImageElement) => node.decode());
	}
	await page.evaluate(async () => {
		await document.fonts.ready;
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
		scrollTo(0, 0);
	});
}
