import type { ModuleData } from '../../../services/git-source-history/ModuleDataService.types';
import type { TreeFile } from '../../../adapters/verification-evidence/EvidenceTreeAdapter.types';
import { randomUUID } from 'node:crypto';
import type { EvidenceTreeAdapter } from '../../../adapters/verification-evidence/EvidenceTreeAdapter';
/** Preserve immutable snapshots; mutable lookup paths follow source-bound review history. */
export async function syncModuleData(
	tree: EvidenceTreeAdapter,
	ref: string,
	remote: string,
	push = true
) {
	if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(remote))
		throw new Error('Use a configured Git remote name.');
	await tree.git.run(['remote', 'get-url', remote]);
	const incoming = `refs/harness/module-data-sync/${randomUUID()}`;
	try {
		const advertised = await tree.git.run(['ls-remote', '--refs', remote, ref]);
		if (advertised) {
			await tree.git.run(['fetch', '--no-tags', remote, `${ref}:${incoming}`]);
			const theirs = (await tree.tip(incoming))!;
			await mergeModuleData(tree, { ref, theirs });
		}
		const commit = await tree.tip(ref);
		if (push && commit) await tree.git.run(['push', remote, `${ref}:${ref}`]);
		return { remote, commit };
	} finally {
		await tree.git.attempt(['update-ref', '-d', incoming]);
	}
}
async function mergeModuleData(tree: EvidenceTreeAdapter, input: { ref: string; theirs: string }) {
	for (let attempt = 0; attempt < 20; attempt++) {
		const ours = await tree.tip(input.ref);
		if (ours === input.theirs || (ours && (await tree.contains(ours, input.theirs)))) return;
		if (!ours || (await tree.contains(input.theirs, ours))) {
			if (await tree.advance(input.ref, input.theirs, ours)) return;
			continue;
		}
		const files = await mergedFiles(tree, ours, input.theirs);
		const next = await tree.commit({
			parents: [ours, input.theirs],
			message: 'chore: merge committed module data',
			files
		});
		if (await tree.advance(input.ref, next, ours)) return;
	}
	throw new Error('Module data changed repeatedly during sync; retry.');
}

async function mergedFiles(
	tree: EvidenceTreeAdapter,
	ours: string,
	theirs: string
): Promise<TreeFile[]> {
	const base = await tree.git.attempt(['merge-base', ours, theirs]);
	const [local, remote, ancestor] = await Promise.all([
		tree.list(ours),
		tree.list(theirs),
		base ? tree.list(base) : new Map<string, string>()
	]);
	const files: TreeFile[] = [];
	for (const [path, blob] of remote) {
		if (!/^(modules|snapshots|reviews|review-snapshots)\//.test(path)) continue;
		const held = local.get(path);
		if (held === blob) continue;
		if (held && held !== blob) {
			const mutable = path.startsWith('modules/') || path.startsWith('reviews/');
			if (!mutable) conflict(path);
			if (path.startsWith('modules/')) {
				const prefer =
					held === ancestor.get(path) ? true : blob === ancestor.get(path) ? false : undefined;
				if (!(await preferReviewedModule(tree, ours, theirs, path, prefer))) continue;
			} else {
				if (blob === ancestor.get(path)) continue;
				if (held !== ancestor.get(path)) conflict(path);
			}
		}
		files.push({ path, content: { blob } });
	}
	return files;
}

/** Lookup aliases may advance after authoring. Immutable digest paths retain every version. */
async function preferReviewedModule(
	tree: EvidenceTreeAdapter,
	ours: string,
	theirs: string,
	path: string,
	preferIncoming?: boolean
) {
	const read = async (commit: string) =>
		JSON.parse((await tree.read(commit, path))!.toString()) as ModuleData;
	const [local, remote] = await Promise.all([read(ours), read(theirs)]);
	const held = new Set((local.reviews ?? []).map((review) => review.digest));
	const incoming = new Set((remote.reviews ?? []).map((review) => review.digest));
	if (held.size === incoming.size && [...held].every((digest) => incoming.has(digest)))
		conflict(path);
	if (preferIncoming !== undefined) return preferIncoming;
	if ([...held].every((digest) => incoming.has(digest))) return true;
	// Divergent, disjoint reviews are retained by the reviews/ union. Neither alias then
	// passes review-vector admission until validate rebuilds their combined declaration.
	return false;
}
function conflict(path: string): never {
	throw new Error(
		`Conflicting immutable module metadata: ${path}. Preserve both histories and repair the producer or review.`
	);
}
