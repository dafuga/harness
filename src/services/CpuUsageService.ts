import { CpuProcessAdapter } from '../adapters/CpuProcessAdapter';
import { cpuMetrics, type CpuReading, type CpuSnapshot } from '../utils/cpuMetrics';
import { setTimeout } from 'node:timers/promises';
export class CpuUsageService {
	private pending?: Promise<CpuSnapshot>;
	constructor(
		private readonly adapter: { sample(): Promise<CpuReading> } = new CpuProcessAdapter()
	) {}
	snapshot(): Promise<CpuSnapshot> {
		this.pending ??= this.measure().finally(() => {
			this.pending = undefined;
		});
		return this.pending;
	}
	private async measure(): Promise<CpuSnapshot> {
		try {
			const before = await this.adapter.sample();
			await setTimeout(1000);
			return cpuMetrics(before, await this.adapter.sample());
		} catch {
			return {
				status: 'unavailable',
				sampledAt: new Date().toISOString(),
				intervalMs: 0,
				logicalCores: 0,
				machinePercent: null,
				trackedPercent: null,
				groups: [],
				agents: []
			};
		}
	}
}
