// @harness-uid u_bji3sakopo
import { commandAction } from '../../utils/development-tooling/commandAction';
import { recordAnalytics } from './analyticsRecord';

import { skipsAnalytics } from './skipsAnalytics';
export { skipsAnalytics } from './skipsAnalytics';

/**
 * Records the finished command, except for help, version and `info` runs: those would otherwise
 * open the analytics database and spawn `git worktree list` before printing a page of text.
 */
export async function recordCommandAnalytics(
	args: readonly string[],
	startedAt: number,
	exitCode: number | string | null | undefined,
	record: typeof recordAnalytics = recordAnalytics
): Promise<void> {
	if (skipsAnalytics(args)) return;
	await record({
		kind: 'command',
		action: commandAction([...args]),
		exitCode: Number(exitCode ?? 0),
		durationMs: Date.now() - startedAt
	});
}
