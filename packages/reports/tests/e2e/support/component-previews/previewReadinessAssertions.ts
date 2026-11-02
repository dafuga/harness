import { expect, type Locator, type Page } from '@playwright/test';
import { previewImages } from './imageZoomActions';
import { settlePreviewAudio } from './audioPreviewReadiness';

/** Loading states are accepted only for the two previews that request them. */
export async function assertPreviewLoading(content: Locator, id: string, variant: string) {
	const message = previewLoadingMessage(id, variant);
	if (message) {
		await expect(content).toContainText(message);
		return;
	}
	await expect(content).not.toContainText(
		/Reading what it holds…|Reading the capture…|Loading screenshot…|Loading recorded activity…|Loading history…|Loading this revision…|Sampling CPU…|Checking sign-in…|Reading the request…/
	);
	if (id === 'reports.component.entity-states')
		await expect(content).not.toContainText('Loading recorded capture…');
}

function previewLoadingMessage(id: string, variant: string): string | undefined {
	if (id === 'reports.component.harness-harness-console' && variant.startsWith('loading-'))
		return variant === 'loading-history' ? 'Loading history…' : 'Loading this revision…';
	if (variant !== 'loading') return;
	const loading: Record<string, string> = {
		'desktop.component.runtime-artifact': 'Reading what it holds…',
		'reports.component.harness-entity-artifact': 'Reading what it holds…',
		'desktop.component.runtime-behavior': 'Reading the recorded results…',
		'reports.component.harness-entity-behavior': 'Reading the recorded results…',
		'reports.component.analytics-cpu': 'Sampling CPU…',
		'reports.component.gameplay-replay': 'Loading screenshot…',
		'reports.component.entity-states': 'Loading recorded capture…'
	};
	return loading[id];
}

export function previewWaitUntil(id: string, variant: string) {
	return ['reports.component.image-zoom', 'reports.component.gameplay-replay'].includes(id) &&
		variant === 'loading'
		? 'domcontentloaded'
		: 'load';
}

/** State transitions finish before pixels are recorded, rather than only before later assertions. */
export async function assertPreviewCaptureState(content: Locator, id: string, variant: string) {
	if (id !== 'reports.component.harness-harness-verdict') return;
	const message = 'The entered Status state is ready for capture';
	if (variant.startsWith('icon')) {
		if (variant !== 'icon') await expect(content.getByRole('status'), message).toBeVisible();
		return;
	}
	if (variant.endsWith('-open')) await expect(content.getByRole('tooltip'), message).toBeVisible();
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
	await assertPreviewReadFailure(content, id, variant);
}

/** Declared failed reads show their precise explanation; ordinary states may not show one. */
async function assertPreviewReadFailure(content: Locator, id: string, variant: string) {
	if (`${id}:${variant}` === 'desktop.component.coverage-panel:failed') {
		await expect(content.getByRole('alert')).toHaveText(
			'Recorded evidence could not be read: The evidence store did not answer the request.'
		);
		return;
	}
	const expected: Record<string, string[]> = {
		'desktop.component.design-panel': ['error'],
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
