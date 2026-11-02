import { previewMountMarkup } from './previewMountMarkup';
import { recordPreviewCapture } from './recordPreviewCapture';
import { captureClip, usesNativePopup } from './previewCapturePolicy';
import { routeShellCatalog } from './shellCatalogRoutes';
import type { PreviewCaptureTarget } from './previewPage.types';
import { expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { evidenceRequested } from '../../../../../../src/utils/record-capture/recordCapture';
import { previewOrigin, servePreview } from './previewApi';
import { catalogUnits, previewState } from './catalogUnits';
import { previewNavigation } from './previewNavigation';
import { previewCaptureBounds, reportViewDialog } from './previewCaptureBounds';
import { hostedFixture } from '../../../../../hub/tests/e2e/hosted-fixture';
import { applyActivityPreviewContext } from './activityPreviewContext';
import { routeLoadingZoom } from './imageZoomActions';
import { settlePreviewAudio } from './audioPreviewReadiness';
import { prepareDesktopPage, frameDesktopCapture } from './desktopStateActions';

import {
	assertPreviewCaptureState,
	assertPreviewLoading,
	assertPreviewMessages,
	previewWaitUntil,
	settlePreviewImages
} from './previewReadinessAssertions';
const pageUnitIds = new Set(
	catalogUnits
		.filter((unit) => unit.owns.source.some((path) => path.endsWith('/+page.svelte')))
		.map((unit) => unit.id)
);
const emptyPreviews = new Set([
	'reports.component.regression-proof:empty',
	'reports.component.activity-list:empty',
	'reports.component.module-system-plugins-plugin-steps:empty',
	'reports.component.report-findings:empty',
	'reports.component.evidence-provenance:empty',
	'reports.component.shared-primitives-detail-list:empty-unprovided'
]);
export async function openPreview(page: Page, home: string, id: string, variant = '') {
	await prepareDesktopPage(page, id, variant);
	if (
		['reports.component.entity-search', 'reports.component.entity-search-results'].includes(id) &&
		page.viewportSize()?.width === 390
	) {
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
	}
	const markup = await previewMountMarkup(id, variant);
	await page.route('**/*', (route) => servePreview(route, home, markup));
	await routeLoadingZoom(page, id, variant);
	await routeShellCatalog(page, id, variant);
	// The real Hub layout creates its own API/session, answered by the existing isolated fixture.
	if (id === 'hub.layout.root') await hostedFixture(page);
	// Freeze calendar labels alone: Playwright's clock also erases NavigationTiming entries.
	await page.addInitScript((now) => {
		const NativeDate = Date;
		window.Date = new Proxy(NativeDate, {
			construct: (target, args, type) =>
				Reflect.construct(target, args.length ? args : [now], type),
			apply: () => new NativeDate(now).toString(),
			get: (target, name) => (name === 'now' ? () => now : Reflect.get(target, name))
		});
	}, Date.parse('2026-10-20T10:00:05Z'));
	await page.goto(
		`${previewOrigin}/?unit=${encodeURIComponent(id)}${variant ? `&variant=${encodeURIComponent(variant)}` : ''}`,
		{
			waitUntil: previewWaitUntil(id, variant)
		}
	);
}
export async function readyPreview(page: Page, id: string, variant = '') {
	const content = page.locator(`[data-preview-unit="${id}"]`);
	await expect(content).toBeAttached();
	if (isBrokenPreviewImage(id, variant))
		await expect(content.locator('.image-button').first()).toBeDisabled();
	await applyActivityPreviewContext(page, content, id);
	await readyRoute(page, id);
	const dialog = {
		'desktop.component.deployment-activity': 'Deployments',
		'desktop.component.deployment-dialog': 'Deploy'
	}[id];
	if (dialog && !(await page.getByRole('dialog').isVisible())) {
		await content.getByRole('button', { name: dialog, exact: true }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		if (dialog === 'Deploy') await expect(page.getByText('Loading promotion…')).toHaveCount(0);
	}
	const emptyComponent = emptyPreviews.has(`${id}:${variant}`);
	if (!emptyComponent) {
		await expect.poll(() => content.locator(':visible').count()).toBeGreaterThan(0);
		await expect.poll(() => content.evaluate((node) => node.childElementCount)).toBeGreaterThan(0);
	}
	await assertPreviewLoading(content, id, variant);
	await assertPreviewMessages(content, id, variant);
	await settlePreviewImages(page, content, id, variant);
	return content;
}
/** Wait for the real route store, rather than its earlier gate or loading frame. */
async function readyRoute(page: Page, id: string) {
	const headings: Record<string, string> = {
		'desktop.page.root': 'Recent projects',
		'desktop.page.harness-path': 'Pages',
		'desktop.page.projects-project-id-harness-path': 'Pages',
		'desktop.page.settings': 'Settings',
		'desktop.page.game': 'Game Views',
		'reports.page.harness-branch-branch-at-styles': 'Styles',
		'reports.page.harness-branch-branch-at-dependencies': 'Dependencies',
		'reports.page.harness-branch-branch-at-translations': 'Translations'
	};
	if (headings[id])
		await expect(page.getByRole('heading', { name: headings[id], exact: true })).toBeVisible();
	if (id === 'hub.page.projects-project-id-harness-path')
		await expect(page.getByRole('heading', { name: 'Pages', exact: true })).toBeVisible();
	if (id === 'hub.page.projects-project-id-members')
		await expect(
			page.getByRole('cell', { name: 'ada@example.invalid', exact: true })
		).toBeVisible();
	if (id === 'hub.page.root')
		await expect(page.getByRole('region', { name: 'Owned by you', exact: true })).toBeVisible();
}
function isBrokenPreviewImage(id: string, variant: string) {
	return (
		variant === 'image-error' &&
		['reports.component.evidence-card', 'reports.component.entity-states'].includes(id)
	);
}

export async function capturePreview(
	page: Page,
	home: string,
	id: string,
	target: PreviewCaptureTarget
) {
	const { viewport, variant = '' } = target;
	const nativeOpen = usesNativePopup(id, variant);
	await assertPreviewCaptureState(page.locator(`[data-preview-unit="${id}"]`), id, variant);
	await settlePreviewAudio(page.locator(`[data-preview-unit="${id}"]`), id, variant);
	await frameDesktopCapture(page, id);
	if (!evidenceRequested() && !process.env.COMPONENT_PREVIEW_SHOTS && !nativeOpen) return;
	const bounds = await previewCaptureBounds(page, id, variant);
	// A native popup is captured from the visible viewport, so its declared bounds stop there.
	const clip = captureClip(page, bounds, nativeOpen);
	const reportDialog = await reportViewDialog(page, id);
	const bytes = await page.screenshot({
		fullPage: !nativeOpen && !reportDialog,
		...(reportDialog ? {} : { clip }),
		animations: 'disabled',
		caret: 'hide'
	});
	const state = previewState(id, variant);
	if (process.env.COMPONENT_PREVIEW_SHOTS) {
		mkdirSync(process.env.COMPONENT_PREVIEW_SHOTS, { recursive: true });
		await import('node:fs/promises').then((fs) =>
			fs.writeFile(join(process.env.COMPONENT_PREVIEW_SHOTS!, `${state}-${viewport}.png`), bytes)
		);
	}
	if (!evidenceRequested()) return { clip, bytes };
	await recordPreviewCapture(home, { id, variant, viewport, clip, bytes, reportDialog });
	if (pageUnitIds.has(id)) await previewNavigation(page, id, viewport);
	return { clip, bytes };
}
