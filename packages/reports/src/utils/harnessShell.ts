import type { ExplorerCategory, ExplorerLocation, ExplorerScope } from '../models/Explorer.types';
import type { HarnessIndex, HarnessRevisionSummary } from '../models/Harness.types';
import { branchCommits, retainedBranch } from './harnessAncestry';
import { categoryIcon, type HarnessIconName } from './harnessIcons';

/** What a host gives the bar of the explorer. */
export interface HarnessNavbarInput {
	/** The mount of the console; the brand leads there while no branch is resolved. */
	base: string;
	/** The repository this website shows; without a name no repository segment is drawn. */
	repository: string | null;
	/** Null while the index loads or the address names nothing: no revision is offered. */
	scope: ExplorerScope | null;
	index: HarnessIndex | null;
	/** The commits of the branch that is shown, newest first. */
	commits: HarnessRevisionSummary[];
	/** The whole address of a location, mount included; every link of the bar is one. */
	href: (to: ExplorerLocation) => string;
	/** A plain click on a link of the bar, or a choice in one of its fields. */
	onroute: (to: ExplorerLocation) => void;
}
/** One tab of a row of tabs; with an address it is a link that a new tab can open. */
export interface HarnessTab<View extends string = string> {
	id: View;
	label: string;
	href?: string;
	disabled?: boolean;
}
export interface HarnessShellLink {
	href: string;
	to: ExplorerLocation;
}
export interface HarnessShellCategory {
	id: ExplorerCategory;
	label: string;
	icon: HarnessIconName;
	active: boolean;
	/** Null, with `to`, while there is no branch and commit to stay in. */
	href: string | null;
	to: ExplorerLocation | null;
}
export interface HarnessShellRevision {
	branch: string;
	commit: string;
	/** The commits to choose from; the viewed one is among them also when no branch lists it. */
	commits: HarnessRevisionSummary[];
	/** Where the tip of the branch is. */
	note: string;
	/** What the viewed commit is to that tip. */
	viewed: string;
	/** The same place on the current branch; null at the tip of it and without a tip. */
	tip: HarnessShellLink | null;
	branchTo: (name: string) => ExplorerLocation;
	commitTo: (commit: string) => ExplorerLocation;
}
export interface HarnessShellView {
	home: { href: string; to: ExplorerLocation | null };
	categories: HarnessShellCategory[];
	revision: HarnessShellRevision | null;
}

const labels: Array<[ExplorerCategory, string]> = [
	['pages', 'Pages'],
	['shells', 'Shells'],
	['components', 'Components'],
	['functions', 'Functions'],
	['configs', 'Configs'],
	['services', 'Services']
];

/** Whether a click is one the application follows itself: plain, primary and not yet handled. */
export function plainClick(event: MouseEvent): boolean {
	const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
	return event.button === 0 && !modified && !event.defaultPrevented;
}

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
	const { location } = scope;
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
		const to = place ? { branch: place.branch, commit: place.commit, category: id } : null;
		const active = place?.category === id;
		return { id, label, icon: categoryIcon[id], active, href: to ? input.href(to) : null, to };
	});
	return {
		home: { href: tip ? input.href(tip) : input.base, to: tip },
		categories,
		revision: scope ? revision(input, scope) : null
	};
}
