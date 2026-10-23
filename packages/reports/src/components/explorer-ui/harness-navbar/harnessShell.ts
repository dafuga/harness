import type {
	HarnessNavbarInput,
	HarnessShellRevision,
	HarnessShellView
} from '../../../utils/explorer-ui/harnessShell';
import { canonicalExplorerLocation } from '../../../../../../src/utils/explorerRoute';
import type {
	ExplorerCategory,
	ExplorerLocation,
	ExplorerScope
} from '../../../models/explorer-ui/Explorer.types';
import { branchCommits } from './harnessAncestry';
import { retainedBranch } from '../../../utils/explorer-ui/harnessAncestry';
import { categoryIcon, type HarnessIconName } from '../../../utils/explorer-ui/harnessIcons';

const labels: Array<[ExplorerCategory | 'styles', string]> = [
	['pages', 'Pages'],
	['shells', 'Shells'],
	['components', 'Components'],
	['functions', 'Helpers'],
	['configs', 'Configs'],
	['services', 'Services'],
	['models', 'Models'],
	['styles', 'Styles'],
	['platforms', 'Platforms']
];

function viewed(scope: ExplorerScope): string {
	if (scope.branch === null) return 'Retained commit';
	if (scope.mode === 'current') return 'Current · branch tip';
	return scope.atTip ? 'Selected commit · branch tip' : 'Historical commit';
}

/** A branch is opened at its tip, on the same entity; the retained commits at their newest. */
function branched(input: HarnessNavbarInput, from: ExplorerLocation, name: string) {
	if (name !== retainedBranch) return { ...from, branch: name, commit: null };
	const newest = input.index ? branchCommits(input.index, retainedBranch)[0] : undefined;
	return { ...from, branch: null, commit: newest?.commit ?? from.commit };
}

function revision(input: HarnessNavbarInput, scope: ExplorerScope): HarnessShellRevision {
	const location = canonicalExplorerLocation(scope.location);
	const listed = input.commits.some((item) => item.commit === scope.commit);
	const current = { ...location, commit: null };
	const there = scope.mode === 'current' || scope.tip === null;
	return {
		branch: scope.branch ?? retainedBranch,
		commit: scope.commit,
		commits: listed ? input.commits : [scope.summary, ...input.commits],
		note: scope.tip ? `Tip · ${scope.tip.slice(0, 7)}` : 'No branch tip',
		viewed: viewed(scope),
		tip: there ? null : { href: input.href(current), to: current },
		branchTo: (name) => branched(input, location, name),
		commitTo: (commit) => ({ ...location, commit })
	};
}

function categoryTarget(
	place: ExplorerLocation | null,
	id: ExplorerCategory | 'styles'
): ExplorerLocation | null {
	if (!place) return null;
	const target: ExplorerLocation = {
		branch: place.branch,
		commit: place.commit,
		category: id === 'styles' ? 'pages' : id
	};
	if (id === 'styles') target.screen = 'styles';
	return target;
}

/**
 * What the bar of the explorer shows for an address: where the brand leads, the five
 * categories inside the branch and commit that are viewed, and the revision controls. Every
 * address is formatted by the host; none is put together here.
 */
export function harnessShell(input: HarnessNavbarInput): HarnessShellView {
	const { scope } = input;
	const place = scope?.location ?? null;
	const tip: ExplorerLocation | null =
		scope && scope.branch !== null
			? { branch: scope.branch, commit: null, category: 'pages' }
			: null;
	const categories = labels.map(([id, label]) => {
		const to = categoryTarget(place, id);
		const active =
			id === 'styles'
				? place?.screen === 'styles'
				: place?.screen !== 'styles' && place?.category === id;
		const icon: HarnessIconName = id === 'styles' ? 'styles' : categoryIcon[id];
		return { id, label, icon, active, href: to ? input.href(to) : null, to };
	});
	return {
		home: { href: tip ? input.href(tip) : input.base, to: tip },
		categories,
		revision: scope ? revision(input, scope) : null
	};
}
