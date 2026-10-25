import type { ConsoleRoute } from '../../src/utils/consoleRoute';
import type { ListedRef, SourceBranch } from '../../src/utils/sourceBranches';

export interface SourceBranchesFixture {
	refs: ListedRef[];
	remotes: string[];
}

export interface SourceBranchesRouteFixture {
	route: ConsoleRoute;
	legacyBranch: string;
}

export interface SourceBranchesExampleInput {
	fixture: string;
	fixtures: SourceBranchesFixture[];
	route?: SourceBranchesRouteFixture;
}

export type BranchPair = [string, string];

export interface SourceBranchesRouteProjection {
	path: string;
	parsed: ConsoleRoute;
	legacyBranch: string;
}

export interface SourceBranchesExampleOutput {
	repository: BranchPair[][];
	utility: BranchPair[][];
	route?: SourceBranchesRouteProjection;
}

export type SourceBranchesCallable = (
	refs: ListedRef[],
	remotes: string[]
) => SourceBranch[];

export type SourceBranchesExampleRunner = (
	input: SourceBranchesExampleInput
) => SourceBranchesExampleOutput;
