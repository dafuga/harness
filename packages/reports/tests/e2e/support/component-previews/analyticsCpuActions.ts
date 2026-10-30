import { expect, type Locator, type Route } from '@playwright/test';
import { cpu } from './analytics';

/** Hold a sample until close for loading; otherwise return a representative CPU response. */
export async function routeCpuFixture(route: Route) {
	const page = route.request().frame().page();
	const variant = new URL(page.url()).searchParams.get('variant');
	if (variant === 'loading') {
		await new Promise<void>((resolve) => page.once('close', () => resolve()));
		return;
	}
	let sample: unknown = cpu;
	if (variant === 'no-agents')
		sample = {
			...cpu,
			trackedPercent: 4,
			agents: [],
			groups: cpu.groups.map((group) =>
				group.id === 'agents'
					? { ...group, machinePercent: 0, corePercent: 0, processes: 0 }
					: group
			)
		};
	if (variant === 'not-measured') sample = { ...cpu, machinePercent: null, trackedPercent: null };
	if (variant === 'unavailable')
		sample = {
			...cpu,
			status: 'unavailable',
			logicalCores: 0,
			intervalMs: 0,
			machinePercent: null,
			trackedPercent: null,
			groups: [],
			agents: []
		};
	return route.fulfill({ json: sample });
}

/** Ensure each captured state has its corresponding live CPU content. */
export async function assertCpuState(component: Locator, variant: string) {
	if (variant === 'loading')
		await expect(component.getByRole('status')).toHaveText('Sampling CPU…');
	else if (variant === 'unavailable')
		await expect(component.getByRole('alert')).toContainText('CPU usage unavailable');
	else if (variant === 'no-agents') {
		await expect(component).toContainText(
			'No agent was working in this repository in this sample.'
		);
		await expect(component.getByTestId('cpu-agents')).toContainText('0.0%');
		await expect(component.getByTestId('cpu-agents')).toContainText('Processes 0');
	} else if (variant === 'not-measured')
		await expect(component.getByTestId('cpu-machine')).toContainText('Not measured');
	else await expect(component.getByTestId('cpu-machine')).toContainText('18.0%');
	if (!variant || variant === 'not-measured') await assertCpuColumnsFit(component);
	if (variant === 'not-measured') await assertMeasuredWordFits(component);
}

async function assertCpuColumnsFit(component: Locator) {
	const area = await component.locator('.analytics-scroll').boundingBox();
	const last = await component.getByRole('columnheader', { name: 'Machine %' }).boundingBox();
	expect(last!.x + last!.width, 'CPU table columns fit in the visible area').toBeLessThanOrEqual(
		area!.x + area!.width
	);
}

async function assertMeasuredWordFits(component: Locator) {
	const value = component.getByTestId('cpu-tracked').locator('strong');
	const lines = await value.evaluate((node) => {
		const range = document.createRange();
		range.setStart(node.firstChild!, 4);
		range.setEnd(node.firstChild!, node.textContent!.length);
		return [...range.getClientRects()].filter((rect) => rect.width > 0).length;
	});
	expect(lines, 'The measured label keeps its word whole').toBe(1);
}
