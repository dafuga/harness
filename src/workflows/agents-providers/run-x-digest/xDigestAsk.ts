// @harness-uid u_auppxpt4f2
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { XDigestConfig } from '../../../core/agents-providers/xDigest.types';

/** Raises one tracker question with choices; the tracker is how Daniel is reached. */
export function xDigestAsk(
	tracker: XDigestConfig['tracker'],
	execute: (command: string, args: string[]) => Promise<object | void> = (command, args) =>
		promisify(execFile)(command, args, { timeout: 60_000 })
): (question: string) => Promise<void> {
	return async (question) => {
		await execute(tracker.command, [
			'flag',
			tracker.item,
			question,
			'--option',
			'Done, or I will do it=Harness reads again at the next run or when asked',
			'--option',
			'Pause the X digest=The daily 08:00 run is turned off',
			'--recommend',
			'1'
		]);
	};
}
