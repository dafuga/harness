import type { PreviewCaptureTarget } from './previewPage.types';
import { expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { BuildIdentityService } from '../../../../../../src/services/BuildIdentityService';
import {
	evidenceRequested,
	recordCapture
} from '../../../../../../src/utils/record-capture/recordCapture';
import { previewOrigin, servePreview } from './previewApi';
import { catalogUnits, previewState } from './catalogUnits';
import { previewNavigation } from './previewNavigation';
import { previewCaptureBounds } from './previewCaptureBounds';
import { hostedFixture } from '../../../../../hub/tests/e2e/hosted-fixture';
import { applyActivityPreviewContext } from './activityPreviewContext';
import { audioComparisonPreMount } from './audioComparisonPreMount';
import { uploadComparisonPreMount } from './uploadComparisonPreMount';
import { uploadAudioPreMount } from './uploadAudioPreMount';
import { routeLoadingZoom } from './imageZoomActions';
import {
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
export async function openPreview(page: Page, home: string, id: string, variant = '') {
	if (
		['reports.component.entity-search', 'reports.component.entity-search-results'].includes(id) &&
		page.viewportSize()?.width === 390
	) {
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
	}
	const markup =
		id === 'reports.component.audio-comparison' && variant === 'pre-mount'
			? await audioComparisonPreMount()
			: id === 'reports.component.upload-comparison' && variant === 'pre-mount'
				? await uploadComparisonPreMount()
				: id === 'reports.component.upload-audio' && variant === 'pre-mount'
					? await uploadAudioPreMount()
					: '';
	await page.route('**/*', (route) => servePreview(route, home, markup));
	await routeLoadingZoom(page, id, variant);
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
	if (id === 'reports.component.evidence-card' && variant === 'image-error')
		await expect(content.locator('.image-button')).toBeDisabled();
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
	const emptyComponent =
		([
			'reports.component.regression-proof',
			'reports.component.activity-list',
			'reports.component.report-findings'
		].includes(id) &&
			variant === 'empty') ||
		(id === 'reports.component.evidence-provenance' && ['empty', 'absent'].includes(variant));
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
export async function capturePreview(
	page: Page,
	home: string,
	id: string,
	target: PreviewCaptureTarget
) {
	const { viewport, variant = '' } = target;
	if (!evidenceRequested() && !process.env.COMPONENT_PREVIEW_SHOTS) return;
	const clip = await previewCaptureBounds(page, id, variant);
	const nativeOpen = usesNativePopup(id, variant);
	const bytes = await page.screenshot({
		fullPage: !nativeOpen,
		clip,
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
	if (!evidenceRequested()) return;
	const served = await new BuildIdentityService().identify(home);
	recordCapture(
		{
			evidence: 'screens',
			kind: 'screenshot',
			state,
			viewport,
			clip,
			file: `${state}-${viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			note: previewCaptureNote(id, variant),
			server: {
				buildId: served?.buildId ?? 'not-built',
				revision: process.env.HARNESS_VERIFY_REVISION ?? '0'.repeat(40)
			}
		},
		bytes
	);
	if (pageUnitIds.has(id)) await previewNavigation(page, id, viewport);
	return { clip, bytes };
}

function usesNativePopup(id: string, variant: string) {
	return (
		(id === 'reports.component.select' && variant === 'open') ||
		(id === 'reports.component.entity-states' &&
			['scenario-open', 'viewport-open'].includes(variant)) ||
		(id === 'reports.component.evidence-grid' && variant === 'status-open') ||
		(id === 'reports.component.upload-comparison' && variant === 'viewport-open') ||
		(id === 'reports.component.upload-audio' && variant === 'mode-open') ||
		(id === 'reports.component.explorer-ui-explorer-translations-screen' &&
			variant === 'language-open')
	);
}

function previewCaptureNote(id: string, variant: string) {
	return id === 'reports.component.evidence-grid' && ['image-open', 'audio-open'].includes(variant)
		? 'Rendered dialog bounds without preview-only canvas. Synthetic representative inputs; real backend and native-device behavior are not reproduced.'
		: 'Rendered component bounds with an 8px edge allowance, excluding preview-only headings and canvas. Synthetic representative inputs; real backend and native-device behavior are not reproduced.';
}
