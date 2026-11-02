import type { Checkpoint } from '../../../../../game/src/index';

/** @pure The checkpoints with the one named id replaced by its edited node. */
export function replaceCheckpoint(
	checkpoints: Checkpoint[],
	id: string | null,
	node: Checkpoint
): Checkpoint[] {
	return checkpoints.map((item) => (item.id === id ? node : item));
}

/** @pure The checkpoints without the one named id, and no other checkpoint requiring it. */
export function withoutCheckpoint(checkpoints: Checkpoint[], id: string): Checkpoint[] {
	return checkpoints
		.filter((item) => item.id !== id)
		.map((item) => ({ ...item, requires: item.requires.filter((required) => required !== id) }));
}

/** @pure Whether a save failure says the stored revision moved on. */
export function isRevisionConflict(message: string): boolean {
	return /revision|conflict|stale|changed/i.test(message);
}
