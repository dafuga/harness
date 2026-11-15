// @harness-uid u_qfigvyo5j5
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { EvidenceTreeAdapter } from '../../../adapters/verification-evidence/EvidenceTreeAdapter';
import { sourceArchiveRef } from '../../../utils/git-source-history/historyRefs';
import type { VideoArchiveClip } from '../VideoArchiveService.types';

/** Source/tree/owner identity is verifiable here; build execution remains the admission boundary. */
export async function sourceBinding(root: string, clip: VideoArchiveClip): Promise<void> {
	const git = new GitAdapter(root),
		{ revision, tree } = clip.original;
	if ((await git.attempt(['rev-parse', '--verify', `${revision}^{tree}`])) !== tree)
		throw new ExpectedCliError('Original video source revision/tree is missing or mismatched.');
	const path = `${revision}:specification/units/${clip.slot.unit}.json`;
	const size = Number(await git.attempt(['cat-file', '-s', path]));
	if (!Number.isSafeInteger(size) || size < 1 || size > 1024 * 1024)
		throw new ExpectedCliError('Original video unit manifest is missing or too large.');
	const owner = JSON.parse(await git.run(['show', path], { maxBuffer: 1024 * 1024 }));
	if (owner.id !== clip.slot.unit || owner.uid !== clip.slot.unitUid || owner.status !== 'active')
		throw new ExpectedCliError('Original video owner identity does not match its source revision.');
}

export async function retainSource(root: string, revision: string): Promise<void> {
	const tree = new EvidenceTreeAdapter(root),
		ref = sourceArchiveRef(revision),
		existing = await tree.tip(ref);
	if (existing === revision) return;
	if (existing || !(await tree.advance(ref, revision, undefined)))
		if ((await tree.tip(ref)) !== revision)
			throw new ExpectedCliError('Original source archive ref conflicts.');
}
