// @harness-uid u_qfigvyo5j5
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { EvidenceBranchRepository } from '../../../repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { evidenceRef } from '../../../core/git-source-history/historyTypes';
import { pointerSchema } from './schema';
import { readVideoBatch, readVideoBatchDescriptor } from './read';
import { fetchArchiveSources } from './source';
import type { VideoArchiveRead, VideoBatchPointer } from '../VideoArchiveService.types';

/** Explicit transfer only: no primary branch or conflicting source/evidence ref is advanced. */
export async function fetchVideoBatch(
	root: string,
	input: VideoBatchPointer,
	remote: string
): Promise<VideoArchiveRead> {
	const pointer = pointerSchema.parse(input),
		tree = new EvidenceBranchRepository(root).tree;
	if (
		!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(remote) ||
		(await tree.git.exec(['remote', 'get-url', remote])).code !== 0
	)
		throw new ExpectedCliError('Use a configured Git remote name.');
	await tree.git.run(['fetch', '--no-tags', '--refmap=', '--', remote, evidenceRef]);
	const tip = await tree.git.run(['rev-parse', 'FETCH_HEAD^{commit}']);
	const descriptor = await readVideoBatchDescriptor(root, pointer, tip);
	await fetchArchiveSources(root, remote, descriptor.batch.clips);
	await tree.git.run([
		'-c',
		'lfs.fetchrecentalways=false',
		'lfs',
		'fetch',
		`--include=${pointer.evidence.path}/media/**`,
		'--exclude=',
		remote,
		pointer.evidence.commit
	]);
	return readVideoBatch(root, pointer, tip);
}
