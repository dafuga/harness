// @harness-uid u_e5rbpkzwhv
import { JobHistoryRepository } from '../../../repositories/execution-runtimes/JobHistoryRepository';
import type { JobsOptions } from '../JobsCommand.types';
export function withJobHistory(
	options: JobsOptions,
	action: (history: JobHistoryRepository) => void
): void {
	const history = new JobHistoryRepository(options.home);
	try {
		action(history);
	} finally {
		history.close();
	}
}
