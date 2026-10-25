import { consoleRoute } from '../../src/utils/console-canonical/consoleRoute';
import { consoleRoutePath } from '../../packages/reports/src/components/project-activity/consoleRoute';
import type {
	BranchPair,
	SourceBranchesCallable,
	SourceBranchesExampleInput,
	SourceBranchesExampleOutput,
	SourceBranchesExampleRunner,
	SourceBranchesRouteFixture,
	SourceBranchesRouteProjection
} from './sourceBranchesExamples.types';
import type { SourceBranch } from '../../src/utils/sourceBranches';

/** Runs every authored fixture through both supported public source-branch aliases. */
export function sourceBranchesExamples(
	repositorySourceBranches: SourceBranchesCallable,
	utilitySourceBranches: SourceBranchesCallable
): SourceBranchesExampleRunner {
	return (input: SourceBranchesExampleInput): SourceBranchesExampleOutput => {
		const output: SourceBranchesExampleOutput = {
			repository: input.fixtures.map(({ refs, remotes }) =>
				display(repositorySourceBranches(refs, remotes))
			),
			utility: input.fixtures.map(({ refs, remotes }) => display(utilitySourceBranches(refs, remotes)))
		};
		return input.route === undefined
			? output
			: { ...output, route: routeProjection(input.route) };
	};
}

/** The original suite asserted the explicit name/head projection, so keep that boundary visible. */
function display(branches: SourceBranch[]): BranchPair[] {
	return branches.map((branch) => [branch.name, branch.head]);
}

function routeProjection(fixture: SourceBranchesRouteFixture): SourceBranchesRouteProjection {
	const path = consoleRoutePath(fixture.route);
	const parsed = consoleRoute(path)!;
	const legacy = consoleRoute(
		consoleRoutePath({ ...fixture.route, branch: fixture.legacyBranch })
	)!;
	return { path, parsed, legacyBranch: legacy.branch! };
}

export type {
	BranchPair,
	SourceBranchesCallable,
	SourceBranchesExampleInput,
	SourceBranchesExampleOutput,
	SourceBranchesExampleRunner,
	SourceBranchesFixture,
	SourceBranchesRouteFixture,
	SourceBranchesRouteProjection
} from './sourceBranchesExamples.types';
