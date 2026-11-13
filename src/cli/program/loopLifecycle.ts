// @harness-uid u_5arojytsh5
import type { Command } from 'commander';
import { fail } from '../../core/development-tooling/errors';
import { closeLoopAbandoned } from '../../workflows/development-tooling/loop-lifecycle/closeLoop';
import {
	listOpenLoops,
	renderOpenLoops
} from '../../workflows/development-tooling/loop-lifecycle/listOpenLoops';
import { renderLoopStatus } from './manageLoop';

export function registerLoopLifecycleCommands(command: Command): void {
	command
		.command('list')
		.option('--stale <days>', 'Only open loops with no step activity for this many days.')
		.option('--json', 'Print structured results.')
		.description('List open loops with age and open-step count.')
		.action((options: { stale?: string; json?: boolean }) => runList(options));

	command
		.command('close <loop>')
		.option('--abandoned', 'Close the loop as abandoned (requires --reason).')
		.option('--reason <text>', 'Why the loop is abandoned.')
		.description('Close a loop without completing its steps.')
		.action((loop: string, options: { abandoned?: boolean; reason?: string }) =>
			runClose(loop, options)
		);
}

async function runList(options: { stale?: string; json?: boolean }): Promise<void> {
	const staleDays = parseDays(options.stale);
	const list = await listOpenLoops({ staleDays });
	console.log(options.json ? JSON.stringify(list, null, 2) : renderOpenLoops(list, staleDays));
}

async function runClose(
	loop: string,
	options: { abandoned?: boolean; reason?: string }
): Promise<void> {
	if (!options.abandoned) fail('Pass --abandoned: it is the only way to close a loop for now.');
	console.log(renderLoopStatus(await closeLoopAbandoned({ loop, reason: options.reason ?? '' })));
}

function parseDays(value: string | undefined): number {
	if (value === undefined) return 0;
	const days = Number(value);
	if (!Number.isSafeInteger(days) || days < 0)
		fail('--stale needs a number of days, 0 or more, as a whole number.');
	return days;
}
