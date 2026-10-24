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
const pageUnitIds = new Set(
	catalogUnits
		.filter((unit) => unit.owns.source.some((path) => path.endsWith('/+page.svelte')))
		.map((unit) => unit.id)
);
export async function openPreview(page: Page, home: string, id: string) {
	await page.route('**/*', (route) => servePreview(route, home));
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
	await page.goto(`${previewOrigin}/?unit=${encodeURIComponent(id)}`);
}
export async function readyPreview(page: Page, id: string) {
	const content = page.locator(`[data-preview-unit="${id}"]`);
	await expect(content).toBeAttached();
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
	await expect.poll(() => content.locator(':visible').count()).toBeGreaterThan(0);
	await expect.poll(() => content.evaluate((node) => node.childElementCount)).toBeGreaterThan(0);
	await expect(content).not.toContainText(
		/Reading what it holds…|Reading the capture…|Loading screenshot…|Loading recorded activity…|Loading history…|Loading this revision…|Sampling CPU…|Checking sign-in…|Reading the request…/
	);
	await expect(content).not.toContainText(
		/This project could not be opened|Loading projects?…|Design preview unavailable|Preview unavailable|Screenshot unavailable|could not be read|not listed by the evidence|Not verified|Reading the clip…|No screenshot (?:is )?recorded|TypeError:|ReferenceError:|Checking the GitHub connection…/
	);
	for (const img of await content.locator('img').all()) {
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
		'reports.page.harness-branch-branch-at-styles': 'Styles'
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
export async function capturePreview(page: Page, home: string, id: string, viewport: string) {
	if (!evidenceRequested() && !process.env.COMPONENT_PREVIEW_SHOTS) return;
	const clip = await previewCaptureBounds(page, id);
	const bytes = await page.screenshot({
		fullPage: true,
		clip,
		animations: 'disabled',
		caret: 'hide'
	});
	const state = previewState(id);
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
			evidence: id,
			kind: 'screenshot',
			state,
			viewport,
			clip,
			file: `${state}-${viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			note: 'Rendered component bounds with an 8px edge allowance, excluding preview-only headings and canvas. Synthetic representative inputs; real backend and native-device behavior are not reproduced.',
			server: {
				buildId: served?.buildId ?? 'not-built',
				revision: process.env.HARNESS_VERIFY_REVISION ?? '0'.repeat(40)
			}
		},
		bytes
	);
	if (pageUnitIds.has(id)) await previewNavigation(page, id, viewport);
}
