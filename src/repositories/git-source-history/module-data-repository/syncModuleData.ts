import { randomUUID } from 'node:crypto';
import type { EvidenceTreeAdapter } from '../../../adapters/verification-evidence/EvidenceTreeAdapter';
/** Union disjoint sealed paths; a conflicting immutable key is an error and nothing is forced. */
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
		const [local, remote] = await Promise.all([tree.list(ours), tree.list(input.theirs)]);
		const files = [...remote].flatMap(([path, blob]) => {
			if (
				!path.startsWith('modules/') &&
				!path.startsWith('snapshots/') &&
				!path.startsWith('reviews/') &&
				!path.startsWith('review-snapshots/')
			)
				return [];
			const held = local.get(path);
			if (held && held !== blob)
				throw new Error(
					`Conflicting immutable module metadata: ${path}. Preserve both histories and repair the producer.`
				);
			return held ? [] : [{ path, content: { blob } }];
		});
		const next = await tree.commit({
			parents: [ours, input.theirs],
			message: 'chore: merge committed module data',
			files
		});
		if (await tree.advance(input.ref, next, ours)) return;
	}
	throw new Error('Module data changed repeatedly during sync; retry.');
}
