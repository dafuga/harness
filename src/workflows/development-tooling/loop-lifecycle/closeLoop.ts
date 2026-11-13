// @harness-uid u_22qpghpzat
import { fail } from '../../../core/development-tooling/errors';
import {
	appendTrace,
	loopPaths,
	loopRoot,
	readLoop,
	timestamp,
	validateLoopId,
	validateRequiredText,
	writeLoop
} from '../loop-state/loopState';
import type { LoopStatus } from '../loop-state/loopState.types';
import { openStepCount } from './loopActivity';
import type { CloseLoopInput } from './closeLoop.types';

/** Closes a loop as abandoned. Steps stay as they are; only `closed` and `updatedAt` change. */
export async function closeLoopAbandoned(input: CloseLoopInput): Promise<LoopStatus> {
	const loop = validateLoopId(input.loop, 'Loop name');
	const reason = validateRequiredText(input.reason, 'Abandon reason');
	const paths = loopPaths(loopRoot(input), loop);
	const state = await readLoop(paths.state);
	if (state.name !== loop) fail('Loop identity does not match its directory.');
	if (state.closed) fail(`Loop "${loop}" is already closed as ${state.closed.status}.`);
	if (openStepCount(state) === 0) fail(`Loop "${loop}" has no pending steps to abandon.`);

	const closedAt = timestamp(input.now);
	state.closed = { status: 'abandoned', reason, closedAt };
	state.updatedAt = closedAt;
	await writeLoop(paths.state, state);
	await appendTrace(paths.trace, {
		event: 'loop.closed',
		timestamp: closedAt,
		loop,
		status: 'abandoned',
		reason
	});

	return { state, tracePath: paths.traceRelative };
}
