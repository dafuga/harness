import { commandAction } from '../../utils/development-tooling/commandAction';
import { recordAnalytics } from './analyticsRecord';

/** Commands that only print a lookup; nothing about them is worth a stored event. */
const lookupCommands = new Set(['help', 'info']);
const versionFlags = new Set(['--version', '-V']);

/** True when the arguments only ask for help, the version or an `info` topic. Reads no state. */
export function skipsAnalytics(args: readonly string[]): boolean {
	if (args.length === 0) return true;
	const terminator = args.indexOf('--');
	const options = terminator < 0 ? args : args.slice(0, terminator);
	if (options.includes('--help') || options.includes('-h')) return true;
	return lookupCommands.has(args[0]) || versionFlags.has(args[0]);
}

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
