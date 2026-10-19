import { expect, type Locator } from '@playwright/test';

/** What the specs of the shell ask of what is drawn: where it is, and how it is styled. */
export const box = async (locator: Locator) => (await locator.boundingBox())!;
export const combo = (within: Locator, name: string) =>
	within.getByRole('combobox', { name, exact: true });
export const styled = (locator: Locator, property: string) =>
	locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
/** Red, green, blue and, when it has one, the opacity of a computed colour. */
export const channels = (colour: string) => (colour.match(/[\d.]+/g) ?? []).map(Number);

/** A control a finger can press, wholly on the screen. */
export async function reachable(control: Locator, width: number): Promise<void> {
	const place = await box(control);
	expect(place.height).toBeGreaterThanOrEqual(32);
	expect(place.x).toBeGreaterThanOrEqual(0);
	expect(place.x + place.width).toBeLessThanOrEqual(width);
}

/** Revision controls stay one small row, with native options and a readable closed value. */
export async function compactRevision(within: Locator): Promise<void> {
	const row = within.locator('.hx-revision, .revision-picker');
	const bounds = await box(row);
	expect(bounds.height, 'compact revision row').toBeLessThanOrEqual(48);
	expect(bounds.width, 'bounded revision width').toBeLessThanOrEqual(380);
	const fields = ['Branch', 'Commit'].map((name) => combo(within, name));
	for (const field of fields) expect((await box(field)).height).toBeLessThanOrEqual(36);
	expect(Math.abs((await box(fields[0])).y - (await box(fields[1])).y)).toBeLessThan(2);
}
