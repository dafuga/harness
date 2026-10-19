import type { Git } from './planGit';
import { safePath } from './planGit';
import type { Files } from './plan-write/planWrite';

export async function stageFiles(git: Git, files: Files, index: string): Promise<void> {
	for (const [path, content] of Object.entries(files)) {
		await safePath(git, path);
		const data = path.endsWith('.png')
			? await git.run(['lfs', 'clean', '--', path], content)
			: content;
		const oid = (await git.run(['hash-object', '-w', '--stdin'], data)).toString().trim();
		await git.run(['update-index', '--add', '--cacheinfo', `100644,${oid},${path}`], undefined, {
			GIT_INDEX_FILE: index
		});
	}
}

export interface CommitContext {
	parent: string;
	branch: string;
	commit: string;
	temp: string;
}

export { planCommit, requireLfsFilters } from './plan-write/planCommit';
