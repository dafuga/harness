// @harness-uid u_x7ymwrkzlr
import type { JobHistoryRepository } from '../../../repositories/execution-runtimes/JobHistoryRepository';
import type { JobRecord } from '../../../repositories/execution-runtimes/JobHistoryRepository.types';
import type { JobsOptions } from '../JobsCommand.types';
/** Lifecycle timestamps require an explicit offset, so recorded durations are timezone-independent. */
export function jobsRecord(
	history: JobHistoryRepository,
	phase: string,
	flags: JobsOptions
): JobRecord {
	const key = { id: flags.id!, source: flags.source!, attempt: Number(flags.attempt ?? '1') };
	const at = flags.at ? Date.parse(flags.at) : Date.now();
	if (!Number.isFinite(at) || (flags.at && !/(Z|[+-]\d{2}:\d{2})$/.test(flags.at)))
		throw new RangeError('--at requires an ISO timestamp with timezone');
	if (phase === 'start')
		return history.start({
			...key,
			unit: flags.unit!,
			type: flags.type!,
			model: flags.model!,
			startedAt: at,
			timingSource: 'runner-clock'
		});
	if (!['pass', 'fail', 'cancelled'].includes(flags.outcome ?? ''))
		throw new RangeError('--outcome must be pass, fail or cancelled');
	return history.end({
		...key,
		endedAt: at,
		outcome: flags.outcome as 'pass' | 'fail' | 'cancelled'
	});
}
