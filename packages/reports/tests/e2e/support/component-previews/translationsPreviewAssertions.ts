import { expect, type Locator, type Page } from '@playwright/test';

/** A native picker can be open while its popup is absent from captured pixels. */
export async function assertOpenLanguagePixels(
	page: Page,
	id: string,
	variant: string,
	capture?: { clip: { x: number; y: number; width: number; height: number }; bytes: Buffer }
) {
	if (
		!capture ||
		id !== 'reports.component.explorer-ui-explorer-translations-screen' ||
		variant !== 'language-open'
	)
		return;
	const { clip, bytes: opened } = capture;
	const language = page.getByRole('combobox', { name: 'Language' });
	await expect.poll(() => language.evaluate((node) => node.matches(':open'))).toBe(true);
	const control = (await language.boundingBox())!;
	await page.mouse.click(1, 1);
	await language.focus();
	await expect.poll(() => language.evaluate((node) => node.matches(':open'))).toBe(false);
	const closed = await page.screenshot({
		fullPage: false,
		clip,
		animations: 'disabled',
		caret: 'hide'
	});
	const changed = await pickerPixelsChanged(page, { opened, closed, clip, control });
	expect(changed, 'The open language menu must change pixels outside its control').toBeGreaterThan(
		100
	);
	await language.click();
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
		await expect(component).toContainText('Not translated');
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
	if (variant === 'german')
		await expect(component.getByRole('columnheader', { name: 'German' })).toBeVisible();
	if (variant === 'more') await expect(component.locator('tbody tr')).toHaveCount(100);
	if (variant === 'missing-values') {
		await expect(component).toContainText('Not translated');
		await expect(component).toContainText('Empty string');
		await expect(component.getByRole('link', { name: 'OrderList' })).toBeVisible();
	}
}
