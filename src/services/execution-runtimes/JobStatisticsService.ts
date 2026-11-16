// @harness-uid u_u6mg7e66nj
import type { JobRecord } from '../../repositories/execution-runtimes/JobHistoryRepository.types';
import type { DurationEstimate, DurationSummary } from './JobStatisticsService.types';
/** Completed failures contribute duration; cancelled and unfinished attempts do not. */
export class JobStatisticsService {
	private readonly records: JobRecord[];
	private readonly cache = new Map<string, DurationEstimate>();
	constructor(records: JobRecord[]) {
		this.records = records.filter(
			(row) =>
				['pass', 'fail'].includes(row.outcome ?? '') &&
				Number.isFinite(row.durationMs) &&
				row.durationMs! >= 0
		);
	}
	summary(): DurationSummary[] {
		const groups = new Map<string, JobRecord[]>();
		for (const record of this.records) {
			const key = JSON.stringify([record.type, record.model]);
			const group = groups.get(key) ?? [];
			group.push(record);
			groups.set(key, group);
		}
		return [...groups.values()].map((rows) => this.summarize(rows, rows[0].type, rows[0].model));
	}
	estimate(type: string, model: string, elapsedMs = 0): DurationEstimate | null {
		const key = JSON.stringify([type, model]);
		if (elapsedMs === 0 && this.cache.has(key)) return this.cache.get(key)!;
		const scopes = [
			{ fallback: 'exact', rows: this.records.filter((r) => r.type === type && r.model === model) },
			{ fallback: 'model', rows: this.records.filter((r) => r.model === model) },
			{ fallback: 'type', rows: this.records.filter((r) => r.type === type) },
			{ fallback: 'global', rows: this.records }
		] as const;
		const scope = scopes.find((s) => s.rows.length >= 5) ?? scopes[3];
		if (!scope.rows.length) return null;
		const full = this.summarize(scope.rows, type, model);
		const surviving = scope.rows.filter((r) => r.durationMs! > elapsedMs);
		const residuals = surviving.map((r) => ({ ...r, durationMs: r.durationMs! - elapsedMs }));
		const summary = residuals.length ? this.summarize(residuals, type, model) : full;
		const tail = elapsedMs > 0 && residuals.length === 0;
		const estimate: DurationEstimate = {
			...summary,
			count: scope.rows.length,
			fallback: scope.fallback,
			conditionalCount: surviving.length,
			tailExtrapolated: tail,
			...(tail
				? {
						medianMs: Math.max(1, full.medianMs * 0.2),
						p80Ms: Math.max(1, full.p80Ms * 0.5),
						p90Ms: Math.max(1, full.p90Ms)
					}
				: {})
		};
		if (elapsedMs === 0) this.cache.set(key, estimate);
		return estimate;
	}
	private summarize(rows: JobRecord[], type: string, model: string): DurationSummary {
		const times = rows.map((r) => r.durationMs!).sort((a, b) => a - b);
		let meanMs = 0;
		for (const [index, duration] of times.entries()) meanMs += (duration - meanMs) / (index + 1);
		const mid = Math.floor(times.length / 2);
		return {
			type,
			model,
			count: times.length,
			meanMs,
			medianMs: times.length % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2,
			p80Ms: times[Math.ceil(times.length * 0.8) - 1],
			p90Ms: times[Math.ceil(times.length * 0.9) - 1]
		};
	}
}
