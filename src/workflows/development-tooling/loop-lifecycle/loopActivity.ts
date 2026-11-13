// @harness-uid u_ymzsomv44i
import type { LoopState } from '../loop-state/loopState.types';
import type { LoopActivity } from './loopActivity.types';

const dayMs = 86_400_000;

export function openStepCount(state: LoopState): number {
	return state.steps.filter((step) => step.status === 'pending').length;
}

/** A loop is open until it is closed explicitly or has no pending step left. */
export function isOpenLoop(state: LoopState): boolean {
	return !state.closed && openStepCount(state) > 0;
}

export function loopActivity(state: LoopState, now: string): LoopActivity {
	const times = [state.updatedAt, state.createdAt, ...state.steps.map((step) => step.completedAt)]
		.map((value) => (value ? Date.parse(value) : Number.NaN))
		.filter((value) => !Number.isNaN(value));
	const base = { openSteps: openStepCount(state), totalSteps: state.steps.length };
	const nowMs = Date.parse(now);
	if (times.length === 0 || Number.isNaN(nowMs)) return base;
	const last = Math.max(...times);
	return {
		...base,
		lastActivityAt: new Date(last).toISOString(),
		ageDays: Math.max(0, Math.floor((nowMs - last) / dayMs))
	};
}

export function isStale(activity: LoopActivity, staleDays: number): boolean {
	return activity.ageDays === undefined || activity.ageDays >= staleDays;
}

export function loopSummaryLines(state: LoopState, now: string): string[] {
	const activity = loopActivity(state, now);
	const age = activity.ageDays === undefined ? 'unknown' : `${activity.ageDays} days`;
	const lines = [
		`Age: ${age} since last activity${activity.lastActivityAt ? ` (${activity.lastActivityAt})` : ''}`,
		`Open steps: ${activity.openSteps} of ${activity.totalSteps}`
	];
	if (state.closed)
		lines.push(
			`Closed: ${state.closed.status} at ${state.closed.closedAt} - ${state.closed.reason}`
		);
	return lines;
}
