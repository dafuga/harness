import { expect, type Locator, type Page } from '@playwright/test';

const pickerNames: Record<string, Record<string, string>> = {
	'reports.component.explorer-ui-explorer-translations-screen': { 'language-open': 'Language' },
	'reports.component.entity-states': { 'scenario-open': 'Scenario', 'viewport-open': 'Viewport' },
	'reports.component.evidence-grid': { 'status-open': 'Status' },
	'reports.component.upload-comparison': { 'viewport-open': 'Viewport' },
	'reports.component.upload-audio': { 'mode-open': 'Audio upload mode' }
};

/** A native picker can be open while its popup is absent from captured pixels. */
export async function assertOpenPickerPixels(
	page: Page,
	id: string,
	variant: string,
	capture?: { clip: { x: number; y: number; width: number; height: number }; bytes: Buffer }
) {
	const name = pickerNames[id]?.[variant];
	if (!capture || !name) return;
	const { clip, bytes: opened } = capture;
	const selector = page.getByRole('combobox', { name });
	await expect.poll(() => selector.evaluate((node) => node.matches(':open'))).toBe(true);
	const control = (await selector.boundingBox())!;
	await page.mouse.click(1, 1);
	await selector.focus();
	await expect.poll(() => selector.evaluate((node) => node.matches(':open'))).toBe(false);
	const closed = await page.screenshot({
		fullPage: id === 'reports.component.entity-states',
		clip,
		animations: 'disabled',
		caret: 'hide'
	});
	const changed = await pickerPixelsChanged(page, { opened, closed, clip, control });
	const message = `The open ${name.toLowerCase()} menu must change pixels outside its control`;
	expect(changed, message).toBeGreaterThan(100);
	await selector.click();
}

/** The failure fixture returns an intentional HTTP error, logged by the browser. */
export function expectUploadErrors(
	id: string,
	variant: string,
	errors: { expectError: (entry: { type: 'console'; message: string; reason: string }) => void }
) {
	if (id === 'reports.component.upload-comparison' && variant === 'error')
		errors.expectError({
			type: 'console',
			message:
				'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
			reason: 'The comparison upload error fixture deliberately refuses the upload.'
		});
	if (
		id === 'reports.component.upload-audio' &&
		['single-error', 'comparison-error'].includes(variant)
	)
		errors.expectError({
			type: 'console',
			message:
				'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
			reason: 'The audio upload error fixture deliberately refuses the upload.'
		});
	if (id === 'reports.component.upload-audio' && variant === 'network-error')
		errors.expectError({
			type: 'console',
			message: 'Failed to load resource: net::ERR_FAILED',
			reason: 'The audio upload network fixture deliberately aborts the request.'
		});
}

/** Compare the captured images outside the selector, excluding focus or arrow changes. */
async function pickerPixelsChanged(
	page: Page,
	{
		opened,
		closed,
		clip,
		control
	}: {
		opened: Buffer;
		closed: Buffer;
		clip: { x: number; y: number; width: number; height: number };
		control: { x: number; y: number; width: number; height: number };
	}
) {
	return page.evaluate(
		async ({ before, after, clip, control }) => {
			async function pixels(source: string) {
				const img = new Image();
				img.src = `data:image/png;base64,${source}`;
				await img.decode();
				const canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
				const ctx = canvas.getContext('2d')!;
				ctx.drawImage(img, 0, 0);
				return ctx.getImageData(0, 0, canvas.width, canvas.height);
			}
			const a = await pixels(before),
				b = await pixels(after);
			const scale = a.width / clip.width;
			let changed = 0;
			for (let y = 0; y < a.height; y++)
				for (let x = 0; x < a.width; x++) {
					const px = x / scale + clip.x,
						py = y / scale + clip.y;
					if (
						px >= control.x - 8 &&
						px <= control.x + control.width + 8 &&
						py >= control.y - 8 &&
						py <= control.y + control.height + 8
					)
						continue;
					const i = (y * a.width + x) * 4;
					if (
						Math.abs(a.data[i] - b.data[i]) +
							Math.abs(a.data[i + 1] - b.data[i + 1]) +
							Math.abs(a.data[i + 2] - b.data[i + 2]) >
						24
					)
						changed++;
				}
			return changed;
		},
		{ before: opened.toString('base64'), after: closed.toString('base64'), clip, control }
	);
}

/** Reach the language, search, pagination and gap states through real controls. */
export async function prepareTranslations(component: Locator, variant: string) {
	if (variant === 'gaps-open') await component.locator('.ex-translations-gaps summary').click();
	if (variant === 'search' || variant === 'no-matches')
		await component
			.getByRole('searchbox', { name: 'Search translations' })
			.fill(variant === 'search' ? 'Écouter' : 'no-such-translation');
	if (variant === 'german')
		await component.getByRole('combobox', { name: 'Language' }).selectOption('de');
	if (variant === 'language-open') {
		const language = component.getByRole('combobox', { name: 'Language' });
		await language.click();
		await expect.poll(() => language.evaluate((node) => node.matches(':open'))).toBe(true);
	}
	if (variant === 'more') await component.getByRole('button', { name: 'View More' }).click();
}

/** Each catalog state states what was recorded and what the selected language contains. */
export async function assertTranslations(component: Locator, variant: string) {
	if (variant === 'unindexed')
		await expect(component).toContainText('No translation catalog is recorded');
	if (variant === 'english-only') {
		await expect(component.getByRole('combobox', { name: 'Language' })).toHaveCount(0);
		await expect(component).toContainText('No comparison languages are recorded at this revision.');
		await expect(component.getByRole('columnheader')).toHaveText(['English', 'Used In']);
		await expect(component).toContainText('Acceptance criteria');
	}
	if (['empty', 'no-matches'].includes(variant))
		await expect(component).toContainText('No translations match this search.');
	if (['gaps', 'gaps-open'].includes(variant))
		await expect(component.locator('.ex-translations-gaps summary')).toContainText(
			'Some translation sources could not be read'
		);
	if (variant === 'gaps-open')
		await expect(component).toContainText('packages/orders/fr.json is unavailable');
	if (variant === 'search') await expect(component.locator('tbody tr')).toHaveCount(1);
	if (variant === 'german') {
		await expect(component.getByRole('columnheader', { name: 'German' })).toBeVisible();
		await expect(component).toContainText('Anhören und vergleichen');
	}
	if (variant === 'more') await expect(component.locator('tbody tr')).toHaveCount(100);
	if (variant === 'missing-values') {
		await expect(component).toContainText('Not translated');
		await expect(component).toContainText('Empty string');
		await expect(component.getByRole('link', { name: 'OrderList' })).toBeVisible();
	}
}
