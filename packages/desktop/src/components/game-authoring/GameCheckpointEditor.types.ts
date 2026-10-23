import type { Checkpoint } from '../../../../game/src/index';

/** The executable rules of a checkpoint; every edit returns a new checkpoint to the parent. */
export interface Props {
	checkpoint: Checkpoint | null;
	change: (node: Checkpoint) => void;
	readonly?: boolean;
}
