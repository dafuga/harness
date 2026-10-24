import type { AnalyticsOptions } from './AnalyticsService.types';
import { projectIdentity } from '../../workflows/reports-media/analyticsRecord';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { AnalyticsRepository } from '../../repositories/reports-media/AnalyticsRepository';
import { analyticsSnapshot } from './analyticsMetrics';
import { importAnalytics } from '../../workflows/reports-media/importAnalytics';
import type { AnalyticsFilter } from '../../core/reports-media/analyticsTypes';
import { analyticsHtml } from './analyticsHtml';
import { sameSite } from '../../utils/accounts-access/repository-identity/repositoryIdentity';
export class AnalyticsService {
	async execute(operation: string, options: AnalyticsOptions): Promise<void> {
		if (operation === 'import') {
			if (!options.root) throw new Error('--root is required.');
			console.log(
				JSON.stringify({
					scannedEvents: await importAnalytics(options.root),
					duplicatesIgnored: true
				})
			);
			return;
		}
		const filter = await normalizeFilter(options);
		const repository = new AnalyticsRepository();
		// A site sees its own repository and nothing else, whatever other filter is asked for.
		const events = options.site
			? repository.events().filter((event) => sameSite(options.site ?? '', event.project))
			: repository.events();
		const snapshot = analyticsSnapshot(events, filter);
		repository.close();
		if (operation === 'export') {
			if (!options.output) throw new Error('--output is required.');
			await writeFile(resolve(options.output), analyticsHtml(snapshot), { mode: 0o600 });
			console.log(
				JSON.stringify({ output: resolve(options.output), events: snapshot.events.length })
			);
			return;
		}
		await renderResult(operation, options, snapshot);
	}
}
export async function normalizeFilter(options: AnalyticsFilter): Promise<AnalyticsFilter> {
	const filter: AnalyticsFilter = {};
	for (const key of ['project', 'loop', 'task', 'model', 'since', 'until'] as const)
		if (options[key]) filter[key] = options[key];
	if (filter.project) filter.project = await projectIdentity(filter.project);
	for (const key of ['since', 'until'] as const) {
		if (!filter[key]) continue;
		const date = new Date(filter[key]);
		if (!Number.isFinite(date.getTime())) throw new Error(`Invalid --${key} date.`);
		if (key === 'until' && /^\d{4}-\d{2}-\d{2}$/.test(filter[key]))
			date.setUTCHours(23, 59, 59, 999);
		filter[key] = date.toISOString();
	}
	return filter;
}

async function renderResult(
	operation: string,
	options: AnalyticsOptions,
	snapshot: ReturnType<typeof analyticsSnapshot>
): Promise<void> {
	const values: Record<string, unknown> = {
		summary: snapshot.summary,
		loops: snapshot.loops,
		jev: snapshot.jev,
		models: snapshot.models,
		benchmarks: snapshot.benchmarks,
		events: snapshot.events
	};
	const value = operation === 'events' ? snapshot : { [operation]: values[operation] };
	const output = options.json
		? JSON.stringify(value, null, 2)
		: `${operation.toUpperCase()}\n${JSON.stringify(value, null, 2)}`;
	await new Promise<void>((resolveOutput, reject) => {
		process.stdout.write(`${output}\n`, (error) => (error ? reject(error) : resolveOutput()));
	});
}

export type { AnalyticsOptions } from './AnalyticsService.types';
