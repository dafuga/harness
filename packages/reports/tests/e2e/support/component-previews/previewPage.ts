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
import { previewImages, routeLoadingZoom } from './imageZoomActions';
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
			waitUntil:
				id === 'reports.component.image-zoom' && variant === 'loading' ? 'domcontentloaded' : 'load'
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
	if (!(id === 'reports.component.regression-proof' && variant === 'empty')) {
		await expect.poll(() => content.locator(':visible').count()).toBeGreaterThan(0);
		await expect.poll(() => content.evaluate((node) => node.childElementCount)).toBeGreaterThan(0);
	}
	if (id === 'reports.component.analytics-cpu' && variant === 'loading')
		await expect(content).toContainText('Sampling CPU…');
	else if (id === 'reports.component.entity-states' && variant === 'loading')
		await expect(content).toContainText('Loading recorded capture…');
	else {
		await expect(content).not.toContainText(
			/Reading what it holds…|Reading the capture…|Loading screenshot…|Loading recorded activity…|Loading history…|Loading this revision…|Sampling CPU…|Checking sign-in…|Reading the request…/
		);
		if (id === 'reports.component.entity-states')
			await expect(content).not.toContainText('Loading recorded capture…');
	}
	await expect(content).not.toContainText(
		/This project could not be opened|Loading projects?…|Design preview unavailable|Preview unavailable|Screenshot unavailable|not listed by the evidence|Not verified|Reading the clip…|TypeError:|ReferenceError:|Checking the GitHub connection…/
	);
	if (
		!(
			id === 'reports.component.explorer-ui-explorer-module-card' &&
			['missing', 'page-missing'].includes(variant)
		)
	)
		await expect(content).not.toContainText(/No screenshot (?:is )?recorded/);
	const expectedReadFailure =
		(id === 'reports.component.activity-agents' &&
			['failed-read', 'unreadable'].includes(variant)) ||
		(id === 'reports.component.project-activity' && variant === 'failed-read') ||
		(id === 'reports.component.explorer-dependencies-screen' &&
			['partial', 'unreadable'].includes(variant)) ||
		(id === 'reports.component.explorer-ui-explorer-translations-screen' &&
			['gaps', 'gaps-open'].includes(variant));
	if (!expectedReadFailure) await expect(content).not.toContainText('could not be read');
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
	const bytes = await page.screenshot({
		fullPage: id !== 'reports.component.select' || variant !== 'open',
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
			note:
				id === 'reports.component.evidence-grid' && ['image-open', 'audio-open'].includes(variant)
					? 'Rendered dialog bounds without preview-only canvas. Synthetic representative inputs; real backend and native-device behavior are not reproduced.'
					: 'Rendered component bounds with an 8px edge allowance, excluding preview-only headings and canvas. Synthetic representative inputs; real backend and native-device behavior are not reproduced.',
			server: {
				buildId: served?.buildId ?? 'not-built',
				revision: process.env.HARNESS_VERIFY_REVISION ?? '0'.repeat(40)
			}
		},
		bytes
	);
	if (pageUnitIds.has(id)) await previewNavigation(page, id, viewport);
}
