import { isHubHomePreview } from './hubHomeCatalogData';
import { allStatesSnapshot, NOW } from '../projectOverviewFixture';
import { previewMountMarkup } from './previewMountMarkup';
import { recordPreviewCapture } from './recordPreviewCapture';
import { captureClip, usesNativePopup } from './previewCapturePolicy';
import { routeShellCatalog } from './shellCatalogRoutes';
import type { PreviewCaptureTarget } from './previewPage.types';
import { expect, type Locator, type Page } from '@playwright/test';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { evidenceRequested } from '../../../../../../src/utils/reports-media/record-capture/recordCapture';
import { previewOrigin, servePreview } from './previewApi';
import { catalogUnits, previewState } from './catalogUnits';
import { previewNavigation } from './previewNavigation';
import { previewCaptureBounds, reportViewDialog } from './previewCaptureBounds';
import { hostedFixture } from '../../../../../hub/tests/e2e/hosted-fixture';
import { applyActivityPreviewContext } from './activityPreviewContext';
import { routeLoadingZoom } from './imageZoomActions';
import { settlePreviewAudio } from './audioPreviewReadiness';
import { prepareDesktopPage, frameDesktopCapture } from './desktopStateActions';
import { explorerPreviewInteraction } from './explorerCatalogVariants';

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
	await routeProjectOverview(page, id);
	await routeLoadingZoom(page, id, variant);
	await routeShellCatalog(page, id, variant);
	// The real Hub layout creates its own API/session, answered by the existing isolated fixture.
	if (id === 'hub.layout.root') await hostedFixture(page);
	await freezeCalendar(page, id);
	await page.goto(
		`${previewOrigin}/?unit=${encodeURIComponent(id)}${variant ? `&variant=${encodeURIComponent(variant)}` : ''}`,
		{
			waitUntil: previewWaitUntil(id, variant)
		}
	);
}
async function freezeCalendar(page: Page, id: string) {
	// Freeze calendar labels alone: Playwright's clock also erases NavigationTiming entries.
	await page.addInitScript(
		(now) => {
			const NativeDate = Date;
			window.Date = new Proxy(NativeDate, {
				construct: (target, args, type) =>
					Reflect.construct(target, args.length ? args : [now], type),
				apply: () => new NativeDate(now).toString(),
				get: (target, name) => (name === 'now' ? () => now : Reflect.get(target, name))
			});
		},
		id === 'hub.page.root' ||
			isHubHomePreview(id) ||
			overviewPreviews.has(id) ||
			id.includes('project-overview-project-overview')
			? NOW
			: Date.parse('2026-10-20T10:00:05Z')
	);
}

export async function readyPreview(page: Page, id: string, variant = '') {
	const content = page.locator(`[data-preview-unit="${id}"]`);
	await expect(content).toBeAttached();
	if (['desktop.page.root', 'desktop.component.projects-sessions-desktop-home'].includes(id))
		await expect(content.getByRole('list', { name: 'Project directory' })).toBeVisible();
	if (id === 'hub.component.projects-sessions-hub-home-dialogs')
		await expect(content.getByRole('dialog', { name: 'Plans' })).toBeVisible();
	if (id === 'hub.component.projects-sessions-hub-home-plan-detail')
		await expect(content.getByRole('dialog', { name: 'Prepare the export cutover' })).toBeVisible();
	if (id === 'desktop.component.development-tooling-tracker-work')
		await expect(content.getByRole('button', { name: 'Prepare the export cutover' })).toBeVisible();
	if (isBrokenPreviewImage(id, variant))
		await expect(content.locator('.image-button').first()).toBeDisabled();
	await applyActivityPreviewContext(page, content, id);
	await readyRoute(page, id);
	await openDeploymentDialog(page, content, id);
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

async function openDeploymentDialog(page: Page, content: Locator, id: string) {
	const dialog = {
		'desktop.component.deployment-activity': 'Deployments',
		'desktop.component.deployment-dialog': 'Deploy'
	}[id];
	if (dialog && !(await page.getByRole('dialog').isVisible())) {
		await content.getByRole('button', { name: dialog, exact: true }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		if (dialog === 'Deploy') await expect(page.getByText('Loading promotion…')).toHaveCount(0);
	}
}
/** Wait for the real route store, rather than its earlier gate or loading frame. */
async function readyRoute(page: Page, id: string) {
	if (overviewPreviews.has(id))
		await expect(page.getByText('Atlas', { exact: true })).toBeVisible();
	if (publicDownloadPreview.has(id))
		await expect(page.getByRole('link', { name: 'Download for Mac' }).first()).toBeVisible();
	const headings: Record<string, string> = {
		'desktop.page.harness-path': 'Pages',
		'desktop.page.projects-project-id-harness-path': 'Pages',
		'desktop.page.settings': 'Settings',
		'desktop.page.game': 'Game Views',
		'reports.page.harness-branch-branch-at-styles': 'Styles',
		'reports.page.harness-branch-branch-at-dependencies': 'Dependencies',
		'reports.page.harness-branch-branch-at-translations': 'Translations',
		'reports.page.harness-branch-branch-at-platforms': 'Platforms'
	};
	if (headings[id])
		await expect(page.getByRole('heading', { name: headings[id], exact: true })).toBeVisible();
	if (id === 'hub.page.projects-project-id-harness-path')
		await expect(page.getByRole('heading', { name: 'Pages', exact: true })).toBeVisible();
	if (id === 'hub.page.projects-project-id-members')
		await expect(
			page.getByRole('cell', { name: 'ada@example.invalid', exact: true })
		).toBeVisible();
	if (id === 'hub.page.root' || id === 'hub.component.projects-sessions-hub-home')
		await expect(page.getByRole('heading', { name: /working, .* need[s]? you/ })).toBeVisible();
	else if (isHubHomePreview(id))
		await expect(page.locator('[data-catalog-home-part]')).toBeAttached();
}
const publicDownloadPreview = new Set([
	'hub.component.public-site-home-page',
	'hub.page.public-site-about'
]);
const overviewPreviews = new Set([
	'desktop.page.projects',
	'hub.page.projects',
	'hub.page.tracker-overview',
	'reports.page.harness-projects'
]);

async function routeProjectOverview(page: Page, id: string) {
	if (overviewPreviews.has(id) && id !== 'desktop.page.projects') {
		const path = id === 'reports.page.harness-projects' ? 'project-overview' : 'tracker-overview';
		await page.route(`**/api/${path}`, (route) => route.fulfill({ json: allStatesSnapshot() }));
	}
	if (publicDownloadPreview.has(id))
		await page.route('**/downloads/Harness-mac-arm64.zip', (route) =>
			route.fulfill({ status: 200, contentType: 'application/zip' })
		);
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
	const interaction = explorerPreviewInteraction(id, variant);
	const nativeOpen = usesNativePopup(id, interaction);
	await assertPreviewCaptureState(page.locator(`[data-preview-unit="${id}"]`), id, interaction);
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
	if (pageUnitIds.has(id)) await previewNavigation(page, id, viewport, variant);
	return { clip, bytes };
}
