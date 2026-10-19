import { ListedRef, SourceBranch } from '../../utils/sourceBranches';
import { evidenceBranch } from "../../core/historyTypes";
import { refKind } from "../../utils/historyRefs";

interface Tracked {
	remote: string;
	branch: string;
	head: string;
}

/**
 * The branches of code a repository knows. A local branch has its own name and tip. A branch
 * the repository has only from its remotes, as a normal clone has every branch but one, keeps
 * its plain name when the remotes agree on its tip, so a history reads the same where it was
 * made and where it was cloned. A remote tip that differs from the local branch of that name, or
 * from another remote, is listed beside it as `<remote>:<branch>`: a colon cannot occur in the
 * name of a branch, so no local branch can have that name, and a local branch is never moved to
 * a tip it does not have. Evidence, notes, archived source and a remote's HEAD are not branches.
 */
export function sourceBranches(refs: ListedRef[], remotes: string[]): SourceBranch[] {
	const local = refs
		.filter((listed) => refKind(listed.ref) === 'source')
		.map((listed) => ({ name: listed.ref.slice('refs/heads/'.length), head: listed.head }));
	const held = new Map(local.map((branch) => [branch.name, branch.head]));
	const tracked = new Map<string, Tracked[]>();
	for (const found of refs.flatMap((listed) => trackedBranch(listed, remotes))) {
		tracked.set(found.branch, [...(tracked.get(found.branch) ?? []), found]);
	}
	const fetched = [...tracked].flatMap(([branch, found]) => named(found, held.get(branch)));
	return [...local, ...fetched].sort((left, right) => (left.name < right.name ? -1 : 1));
}

/** A remote-tracking ref as the branch of a remote; the longest configured remote name wins. */
function trackedBranch(listed: ListedRef, remotes: string[]): Tracked[] {
	if (refKind(listed.ref) !== 'remote' || listed.symbolic) return [];
	const path = listed.ref.slice('refs/remotes/'.length);
	const configured = remotes
		.filter((name) => path.startsWith(`${name}/`))
		.sort((left, right) => right.length - left.length)[0];
	const remote = configured ?? path.split('/')[0];
	const branch = path.slice(remote.length + 1);
	if (!branch || branch === 'HEAD' || branch === evidenceBranch) return [];
	return [{ remote, branch, head: listed.head }];
}

/** What the remotes add for one branch name: nothing for a tip the local branch already has. */
function named(found: Tracked[], local: string | undefined): SourceBranch[] {
	const other = found.filter((item) => item.head !== local);
	const tips = new Set(other.map((item) => item.head));
	if (local === undefined && tips.size === 1)
		return [{ name: other[0].branch, head: other[0].head }];
	return other.map((item) => ({ name: `${item.remote}:${item.branch}`, head: item.head }));
}
