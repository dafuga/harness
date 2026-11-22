import type {
	TrackerItemMutationContext,
	TrackerItemSnapshot
} from '../../../src/utils/projects-sessions/planTrackerItemMutation.types';

export const now = '2026-07-01T23:30:00.000Z';
export const clock = Object.freeze({
	node: 'fixture-node',
	now: Date.parse(now),
	launchNonce: 'fixture-nonce'
});

export const context: TrackerItemMutationContext = Object.freeze({
	...clock,
	candidates: []
});

export const item: TrackerItemSnapshot = Object.freeze({
	id: 'item-fixture',
	title: 'Review runner queue',
	kind: 'task',
	status: 'blocked',
	agent: 'fixture',
	needs_daniel: 1,
	resolved: 1
});
