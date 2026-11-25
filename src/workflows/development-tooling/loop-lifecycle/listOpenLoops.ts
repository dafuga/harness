// @harness-uid u_oprumo3dm2
import { fail } from '../../../core/development-tooling/errors';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { errorMessage } from '../../../../packages/reports/src/helpers/strings/errorMessage';
import { isMissingFile, loopPaths, loopRoot, readLoop, timestamp } from '../loop-state/loopState';
import { isOpenLoop, isStale, loopActivity } from './loopActivity';
import type { ListLoopsInput, OpenLoop, OpenLoopList } from './listOpenLoops.types';

/** Lists open loops, oldest activity first; with staleDays, only those idle that long. */
export async function listOpenLoops(input: ListLoopsInput = {}): Promise<OpenLoopList> {
	const root = loopRoot(input);
	const now = timestamp(input.now);
	const staleDays = validateStaleDays(input.staleDays);
	const result: OpenLoopList = { loops: [], unreadable: [] };
	for (const name of await loopNames(root)) {
		try {
			const state = await readLoop(loopPaths(root, name).state);
			if (state.name !== name) fail('Loop identity does not match its directory.');
			const activity = loopActivity(state, now);
			if (isOpenLoop(state) && isStale(activity, staleDays))
				result.loops.push({ name: state.name, goal: state.goal, ...activity });
		} catch (error) {
			if (!isMissingFile(error)) result.unreadable.push({ name, error: errorMessage(error) });
		}
	}
	result.loops.sort(byOldestActivity);
	return result;
}

export function renderOpenLoops(list: OpenLoopList, staleDays = 0): string {
	const scope = staleDays > 0 ? `idle for ${staleDays}+ days` : 'open';
	const lines =
		list.loops.length === 0
			? [`No ${scope} loops.`]
			: list.loops.map((loop) => {
					const age = loop.ageDays === undefined ? 'age unknown' : `${loop.ageDays}d idle`;
					return `${loop.name}  ${age}  ${loop.openSteps} open of ${loop.totalSteps} steps  ${loop.goal}`;
				});
	for (const item of list.unreadable) lines.push(`unreadable: ${item.name} (${item.error})`);
	return lines.join('\n');
}

async function loopNames(root: string): Promise<string[]> {
	try {
		const entries = await readdir(join(root, 'specification', 'loops'), { withFileTypes: true });
		return entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();
	} catch (error) {
		if (isMissingFile(error)) return [];
		throw error;
	}
}

function byOldestActivity(a: OpenLoop, b: OpenLoop): number {
	return (b.ageDays ?? Infinity) - (a.ageDays ?? Infinity) || a.name.localeCompare(b.name);
}

function validateStaleDays(value = 0): number {
	if (!Number.isSafeInteger(value) || value < 0)
		fail('Stale days must be a nonnegative whole number.');
	return value;
}
