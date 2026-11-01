import { expect, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { desktopFixtureCommits as commits } from './desktopFixtureCommits';

/** Comparison fixtures must paint checked captures from both real evidence contexts. */
export async function assertDesktopScreenCapture(component: Locator, id: string, variant: string) {
	if (id !== 'desktop.component.runtime-screens') return;
	for (const gap of await component.locator('p.runtime-gap, .runtime-gap li').all())
		await assertGapMessage(gap);
	if (!['paired', 'incomparable'].includes(variant)) return;
	await expect(
		component.getByRole('heading', {
			name: variant === 'paired' ? 'Before and after' : 'Before and after, not alike',
			exact: true
		})
	).toBeVisible();
	for (const [side, hash] of [
		['Before', commits.middle],
		['After', commits.tip]
	]) {
		const pane = component.getByRole('figure', {
			name: `${side} · ${hash.slice(0, 7)}`,
			exact: true
		});
		await expect(pane).toBeVisible();
		const image = pane.getByRole('img');
		await expect(image).toBeVisible();
		expect(
			await image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
			`${side} screenshot contains decoded original bytes`
		).toBe(true);
	}
}

/** An open disclosure must retain its actual content inside the original recorded crop. */
export async function assertDesktopArtifactCapture(
	component: Locator,
	id: string,
	variant: string
) {
	if (id !== 'desktop.component.runtime-artifact') return;
	await assertReadableResult(component, variant);
	if (variant !== 'json-open') return;
	const directory = process.env.HARNESS_EVIDENCE_DIR;
	if (!directory || process.env.TAKE_SCREENSHOT !== '1') return;
	const raw = component.getByText('Recorded JSON', { exact: true }).locator('..').locator('pre');
	await expect(raw).toBeVisible();
	const capture = readFileSync(join(directory, 'captures.ndjson'), 'utf8')
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line))
		.findLast(
			(slot) =>
				slot.kind === 'screenshot' && slot.state === 'desktop-component-runtime-artifact-json-open'
		);
	expect(capture?.clip).toBeDefined();
	const bounds = await raw.evaluate((node) => {
		const box = node.getBoundingClientRect();
		return { top: box.top + scrollY, bottom: box.bottom + scrollY };
	});
	expect(bounds.top).toBeGreaterThanOrEqual(capture.clip.y);
	expect(
		bounds.bottom,
		'Opened recorded JSON is completely inside the captured image'
	).toBeLessThanOrEqual(capture.clip.y + capture.clip.height + 1);
}

async function assertReadableResult(component: Locator, variant: string) {
	if (variant === 'output') {
		await expect(component.getByText('Recorded output details', { exact: true })).toBeVisible();
		await expect(
			component.getByText('Assertions and recorded result', { exact: true })
		).toHaveCount(0);
	}
	if (['', 'text', 'recorded-open', 'json-open'].includes(variant)) {
		await expect(component, 'Recorded results do not claim to be empty').not.toContainText(
			'This result records no input and output.'
		);
	}
	if (['recorded-open', 'json-open'].includes(variant)) {
		await expect(component.locator('ol li').nth(1)).toHaveText('Search for “SERVICE”');
		expect(
			await component.innerText(),
			'Recorded results use meaningful workload descriptions'
		).not.toMatch(/synthetic orders|taken for [a-f\d]{7}/i);
	}
	if (['unreadable', 'unstored'].includes(variant)) {
		await assertGapMessage(component.locator('.runtime-gap'));
	}
}

async function assertGapMessage(row: Locator) {
	const separation = await row.evaluate((node) => {
		const icon = node.querySelector('button')!.getBoundingClientRect();
		const message = node.lastElementChild!.getBoundingClientRect();
		return { actual: message.left - icon.right, gap: parseFloat(getComputedStyle(node).gap) };
	});
	expect(separation.actual, 'Runtime gap message stays beside its status icon').toBeLessThanOrEqual(
		separation.gap + 1
	);
}

export async function assertDesktopBehaviorState(component: Locator, variant: string) {
	if (['', 'paired'].includes(variant)) {
		await expect(component).toContainText('What a test observed end to end.');
		await expect(component).toContainText('Order 1042 · Service call');
	}
	if (variant === 'paired') {
		for (const [side, hash] of [
			['Before', commits.middle],
			['After', commits.tip]
		]) {
			const group = component.getByRole('group', {
				name: `${side} · ${hash.slice(0, 7)}`,
				exact: true
			});
			await expect(group).toBeVisible();
			await expect(group).toContainText('What a test observed end to end.');
		}
	}
	if (['loading', 'unreadable'].includes(variant))
		await expect(component).not.toContainText('What a test observed end to end.');
}

/** One test has one assertion disclosure; its recorded output has its own caption. */
export async function assertDesktopBehaviorCapture(
	component: Locator,
	id: string,
	variant: string
) {
	if (id !== 'desktop.component.runtime-behavior' || !['', 'paired'].includes(variant)) return;
	for (const state of await component.locator('.runtime-state').all())
		await expect(
			state.getByText('Assertions and recorded result', { exact: true }),
			'Each test presents its assertions once'
		).toHaveCount(1);
	await expect(
		component.getByText('Recorded output details', { exact: true }).first()
	).toBeVisible();
}
