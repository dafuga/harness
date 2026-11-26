import type {
	focusedCaptures,
	focusedScenario
} from '../../src/utils/explorer-ui/explorer-evidence/focusedCaptures';

export type Detail = Parameters<typeof focusedCaptures>[0];

export type Side = NonNullable<Parameters<typeof focusedScenario>[0][number]>;

export type Size = { width: number; height: number };

export type PointInput = {
	commit: string;
	tree: string;
	id: string;
	status: string;
	finishedAt: string;
	captures: unknown[];
};
