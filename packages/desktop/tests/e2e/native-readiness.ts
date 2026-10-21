import { expect, type Locator, type Page } from '@playwright/test';

/** What a native capture must show before any pixels of it are recorded. */
export interface NativeExpected {
	state: 'draft' | 'design' | 'approved' | 'history';
	unitId: string;
	/** The commit the Commit picker must show: the tip, or the historical commit opened. */
	commit: string;
}

const title = 'Native activity';

function address({ state, unitId, commit }: NativeExpected): RegExp {
	const pinned = state === 'history' ? `/commit/${commit}` : '';
	const entity = encodeURIComponent(unitId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`/branch/feat%2Fnative${pinned}/pages/${entity}/designs$`);
}

/** The Designs section of the expected entity at the expected commit, current or historical. */
async function designsAt(page: Page, expected: NativeExpected): Promise<void> {
	await expect(page).toHaveURL(address(expected));
	await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
	const sections = page.getByRole('navigation', { name: 'Entity sections' });
	await expect(sections.getByRole('button', { name: 'Designs', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByLabel('Commit', { exact: true })).toHaveValue(expected.commit);
	const note =
		expected.state === 'history'
			? `Historical commit · ${expected.commit.slice(0, 7)}`
			: 'Current · branch tip';
	await expect(page.getByLabel('Commit', { exact: true })).toHaveAttribute('title', note);
	await expect(page.getByRole('button', { name: 'Choose commit', exact: true })).toBeVisible();
}

/** Approval is offered on the tip, recorded once approved, and refused on a historical commit. */
async function approval(page: Page, state: NativeExpected['state']): Promise<void> {
	const approve = page.getByRole('button', { name: 'Approve v001', exact: true });
	if (state === 'design') await expect(approve).toBeEnabled();
	if (state === 'history') await expect(approve).toBeDisabled();
	if (state !== 'approved') return;
	await expect(approve).toHaveCount(0);
	await expect(
		page.getByRole('button', { name: 'Design v001 approved', exact: true })
	).toBeDisabled();
}

/** A visible image whose bytes loaded with positive natural size and decode without error. */
async function decoded(image: Locator): Promise<void> {
	await expect(image).toBeVisible();
	await expect
		.poll(() => image.evaluate((element: HTMLImageElement) => element.complete))
		.toBe(true);
	const size = await image.evaluate(async (element: HTMLImageElement) => {
		await element.decode();
		return { width: element.naturalWidth, height: element.naturalHeight };
	});
	expect(size.width).toBeGreaterThan(0);
	expect(size.height).toBeGreaterThan(0);
}

/** Fonts are ready and every image on the page decodes; a decode failure fails the capture. */
async function settled(page: Page): Promise<void> {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
}

/** Proves the page shows the expected state; it runs before every native capture. */
export async function nativeReady(page: Page, expected: NativeExpected): Promise<void> {
	await designsAt(page, expected);
	if (expected.state === 'draft') {
		await expect(page.getByRole('heading', { name: 'No design image yet' })).toBeVisible();
		await expect(page.locator('.image-canvas')).toHaveCount(0);
		return settled(page);
	}
	await approval(page, expected.state);
	const main = page.locator('.image-canvas');
	await decoded(main.getByRole('img', { name: `${title} v001 desktop default`, exact: true }));
	const strip = page.locator('.version-strip');
	await decoded(strip.getByRole('img', { name: `${title} v001`, exact: true }));
	await expect(page.getByText('Loading design image…')).toHaveCount(0);
	await expect(page.getByText('Preview unavailable')).toHaveCount(0);
	await settled(page);
}
