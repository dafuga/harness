// @harness-uid u_izz5miwhbq
import { readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { JobHistoryRepository } from '../../repositories/execution-runtimes/JobHistoryRepository';
import type { JobRecord } from '../../repositories/execution-runtimes/JobHistoryRepository.types';
import type { BackfillResult, HistoricalResult } from './JobBackfillService.types';
import { driverJobType } from '../../adapters/execution-runtimes/driver-queue/driverFiles';
import { historicalIdentity, historicalOutcome } from './job-backfill/historicalRecord';
import { resultFiles } from './job-backfill/resultFiles';
/** Imports original elapsed wall time; inferred historical timestamps are labelled. */
export class JobBackfillService {
	constructor(private readonly history: JobHistoryRepository) {}
	import(root: string): BackfillResult {
		const result: BackfillResult = { imported: 0, duplicate: 0, skipped: 0, errors: [] };
		for (const path of resultFiles(root)) {
			try {
				const record = this.record(path, root);
				if (!record) {
					result.skipped++;
					continue;
				}
				if (this.history.import(record)) result.imported++;
				else result.duplicate++;
			} catch (error) {
				result.skipped++;
				result.errors.push(`${relative(root, path)}: ${String(error)}`);
			}
		}
		return result;
	}
	private record(path: string, root: string): JobRecord | null {
		const data = JSON.parse(readFileSync(path, 'utf8')) as HistoricalResult;
		const duration = this.duration(data);
		if (duration === null || !Number.isFinite(duration) || duration < 0) return null;
		const endedAt = Math.round(statSync(path).mtimeMs),
			durationMs = Math.round(duration * 1000);
		const collection = relative(root, path).split('/')[0];
		const model = data.model ?? data.worker ?? relative(root, path).split('/')[1];
		return {
			...historicalIdentity(data, path),
			source: `backfill:${resolve(path)}`,
			attempt: 1,
			type: driverJobType(collection),
			model,
			startedAt: endedAt - durationMs,
			endedAt,
			durationMs,
			outcome: historicalOutcome(data.status),
			timingSource: 'file-mtime-minus-duration'
		};
	}
	private duration(data: HistoricalResult): number | null {
		if (typeof data.seconds === 'number') return data.seconds;
		if (typeof data.wall_minutes === 'number') return data.wall_minutes * 60;
		// Re-verify's serial attempts are the entire recorded workload; worker-only times are not wall time.
		if (data.tried?.length && data.tried.every((attempt) => typeof attempt.seconds === 'number'))
			return data.tried.reduce((sum, attempt) => sum + attempt.seconds!, 0);
		return null;
	}
}
