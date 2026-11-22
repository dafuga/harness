// @harness-uid u_dxm76skvf6
import type { QueueEstimate } from '../../../services/execution-runtimes/QueueEtaService.types';
import type { DurationSummary } from '../../../services/execution-runtimes/JobStatisticsService.types';
/** @pure Human-readable wall-time estimate in hours, minutes and seconds. */
export function jobDuration(ms: number | null): string {
	if (ms === null) return 'unknown';
	const seconds = Math.ceil(ms / 1000);
	return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
}
/** Print sample scope and the scheduling range without implying statistical confidence. */
export function printJobEta(result: QueueEstimate): void {
	console.log(`Queue ETA: ${result.status}; ${result.queued} queued + ${result.running} running`);
	console.log(`Slots: ${JSON.stringify(result.slots)}`);
	console.log(
		`Remaining (p50–p90 duration scenarios): ${jobDuration(result.p50Ms)} – ${jobDuration(result.p90Ms)}`
	);
	console.log(`Finish: ${result.finish.p50 ?? 'unknown'} – ${result.finish.p90 ?? 'unknown'}`);
	for (const e of result.estimates)
		console.log(
			`  ${e.type}/${e.model}: ${e.count} samples; fallback=${e.fallback}; median=${jobDuration(e.medianMs)}, p90=${jobDuration(e.p90Ms)}`
		);
	for (const warning of result.warnings) console.log(`Note: ${warning}`);
}
export function printJobStats(groups: DurationSummary[]): void {
	console.log('Type / Model | Samples | Mean | Median | p80 | p90');
	for (const g of groups)
		console.log(
			`${g.type} / ${g.model} | ${g.count} | ${jobDuration(g.meanMs)} | ${jobDuration(g.medianMs)} | ${jobDuration(g.p80Ms)} | ${jobDuration(g.p90Ms)}`
		);
	if (!groups.length)
		console.log('No completed duration samples; use jobs backfill or jobs record.');
}
