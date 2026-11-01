import { expect, type Locator } from '@playwright/test';
import { assertSpecialReportState } from './reportSpecialAssertions';
import { previewCaptureBounds } from './previewCaptureBounds';

/** Check that each additional report preview actually renders its distinct state. */
export async function assertReportPreviewState(component: Locator, id: string, variant = '') {
	if (await assertSpecialReportState(component, id, variant)) return;
	if (id === 'reports.component.modal' && variant === 'image') {
		const dialog = component.getByRole('dialog', { name: 'Order card evidence' });
		await expect(dialog).toBeVisible();
		await expect(dialog).not.toHaveClass(/\b(?:text|lightbox)\b/);
		await expect(dialog.getByRole('img', { name: 'Order card evidence' })).toBeVisible();
	}
	if (!id.startsWith('reports.component.source-')) return;
	return assertSourcePreviewState(component, id, variant);
}

async function assertSourcePreviewState(component: Locator, id: string, variant: string) {
	if (id === 'reports.component.source-file-list' && variant !== 'empty')
		await expect(component.getByRole('button', { name: 'View code', exact: true })).toHaveCount(2, {
			timeout: 1_000
		});
	if (
		!variant &&
		['source-content', 'source-dialog', 'source-viewer'].some((name) => id.endsWith(name))
	) {
		const code = component.locator('.source-code');
		await expect(code).toBeVisible();
		const fits = await code.evaluate((node) => node.scrollWidth <= node.clientWidth);
		expect(fits, 'Representative source fits without horizontal clipping').toBe(true);
	}
	if (variant === 'loading-file') {
		await expect(component.getByRole('combobox', { name: 'Source file' })).toBeVisible();
		await expect(component.getByRole('status')).toHaveText('Loading source…');
	}
	if (variant === 'loading-list') {
		await expect(component.getByRole('combobox', { name: 'Source file' })).toHaveCount(0);
		await expect(component.getByRole('status')).toHaveText('Loading source…');
	}
	if (variant === 'list-error') {
		await expect(component.getByRole('combobox', { name: 'Source file' })).toHaveCount(0);
		await expect(component.getByRole('alert')).toContainText('file list is unavailable');
	}
	if (variant === 'empty-file') {
		await expect(component.getByRole('combobox', { name: 'Source file' })).toHaveValue(
			'src/components/OrderList.svelte'
		);
		await expect(component.getByRole('status').filter({ hasText: 'Loading source…' })).toBeHidden();
	}
}

/** Inspect the exact settled state after its canonical screenshot is retained. */
export async function assertRecordedReportPreviewState(
	component: Locator,
	id: string,
	variant: string
) {
	await assertCatalogStateDistinction(component, id, variant);
	if (id === 'reports.component.select' && variant === 'open') await expandedSelect(component);
	if (id.startsWith('reports.component.source-') && variant === 'empty-file') {
		await expect(component.getByRole('status')).toHaveText('This file is empty.');
		await expect(component.locator('.source-code')).toHaveCount(0);
	}
	if (id === 'reports.component.source-file-list' && variant === 'linked') {
		const links = component.getByRole('link');
		await expect(links).toHaveCount(2);
		for (const link of await links.all()) {
			await expect(link).toHaveAttribute('target', '_blank');
			await expect(
				link.locator('.source-name'),
				'Linked filenames visibly identify a destination'
			).toHaveCSS('text-decoration-line', 'underline');
		}
		await links.first().focus();
		await expect(links.first()).toBeFocused();
	}
	if (id === 'reports.component.modal' && variant === 'lightbox') {
		const image = component.getByRole('img', { name: 'Order card evidence' });
		const box = (await image.boundingBox())!;
		const clip = await previewCaptureBounds(component.page(), id, variant);
		expect(
			(box.width * box.height) / (clip.width * clip.height),
			'Lightbox capture frames the image rather than unused canvas'
		).toBeGreaterThan(0.45);
		await expect(component.locator('figcaption')).toHaveText('Order A-1048 · Ready to ship');
	}
}

/** Check visible state distinctions after retaining the same settled screenshot. */
async function assertCatalogStateDistinction(component: Locator, id: string, variant: string) {
	const key = `${id}:${variant}`;
	const gaps: Record<string, string> = {
		'reports.component.explorer-ui-explorer-platform-details:unindexed':
			'No platform catalog is indexed at this revision.',
		'reports.component.explorer-ui-explorer-translations-screen:empty':
			'No translation strings are recorded at this revision.',
		'reports.component.networking-security-explorer-permissions-screen:endpoint-unindexed':
			'No permission catalog is indexed at this revision.'
	};
	if (key === 'reports.component.explorer-ui-config-value-tree:disclosure-hovered')
		await assertDisclosurePaint(component);
	if (gaps[key])
		await expect(component, 'Catalog absence and empty data stay distinct').toContainText(
			gaps[key]
		);
	if (
		key === 'reports.component.explorer-ui-explorer-platforms:status-options-open' ||
		key === 'reports.component.explorer-ui-explorer-translations-screen:language-open'
	)
		await assertCatalogPickerClearance(component, id);
}

async function assertDisclosurePaint(component: Locator) {
	const summary = component.locator('summary').first();
	const paint = () =>
		summary.evaluate((node) => {
			const style = getComputedStyle(node);
			return [style.backgroundColor, style.color, style.boxShadow].join('/');
		});
	const hovered = await paint();
	await component.page().mouse.move(1, 1);
	const resting = await paint();
	expect(hovered, 'Disclosure hover changes visible paint').not.toEqual(resting);
	await summary.hover();
}

async function assertCatalogPickerClearance(component: Locator, id: string) {
	const platform = id === 'reports.component.explorer-ui-explorer-platforms';
	const select = component.getByRole('combobox', { name: platform ? 'Status filter' : 'Language' });
	const menu = await select.evaluate((node: HTMLSelectElement) => {
		const boxes = [...node.options].map((option) => option.getBoundingClientRect());
		return {
			bottom: Math.max(...boxes.map((box) => box.bottom)),
			painted: boxes.every((box) => box.width > 0 && box.height > 0)
		};
	});
	expect(menu.painted, 'Every open catalog option is painted').toBe(true);
	const next = platform
		? component.getByRole('button', { name: 'Done', exact: true })
		: component.getByRole('columnheader', { name: 'English', exact: true });
	const boundary = (await next.boundingBox())!;
	expect(
		menu.bottom,
		'Open catalog options leave headings and dialog actions clear'
	).toBeLessThanOrEqual(boundary.y);
	if (platform) {
		const dialog = (await component.getByRole('dialog', { name: 'Filters' }).boundingBox())!;
		expect(menu.bottom, 'Open status options fit inside the dialog').toBeLessThanOrEqual(
			dialog.y + dialog.height
		);
	}
}

async function expandedSelect(component: Locator) {
	const field = component.getByRole('listbox', { name: 'Viewport', exact: true });
	await expect(field, 'Open Select exposes an in-page listbox').toBeVisible();
	await expect(field.getByRole('option')).toHaveText(['Desktop', 'Tablet', 'Mobile']);
	const painted = await field.evaluate((node: HTMLSelectElement) => {
		const frame = node.getBoundingClientRect();
		return [...node.options].every((option) => {
			const box = option.getBoundingClientRect();
			return box.width > 0 && box.height > 0 && box.top >= frame.top && box.bottom <= frame.bottom;
		});
	});
	expect(painted, 'Every open Select option is painted inside the listbox').toBe(true);
	await field.selectOption('tablet');
	await expect(field).toHaveValue('tablet');
	await field.focus();
	await field.press('Home');
	await expect(field).toHaveValue('desktop');
}
