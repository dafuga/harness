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
	if (variant === 'no-agents') sample = { ...cpu, agents: [] };
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
	else if (variant === 'no-agents')
		await expect(component).toContainText(
			'No agent was working in this repository in this sample.'
		);
	else if (variant === 'not-measured')
		await expect(component.getByTestId('cpu-machine')).toContainText('Not measured');
	else await expect(component.getByTestId('cpu-machine')).toContainText('18.0%');
}
