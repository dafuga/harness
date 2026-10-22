import { z } from 'zod';
import type { GitHubTransport } from './githubTransport';
import { fail, parse, sha } from '../planning-collaboration/parseCollaborationInput';

export async function ensureAncestry(
	client: GitHubTransport,
	commit: string,
	tip: string
): Promise<void> {
	if (commit === tip) return;
	const comparison = parse(
		z.object({
			status: z.enum(['ahead', 'behind', 'identical', 'diverged']),
			merge_base_commit: z.object({ sha })
		}),
		(await client.request(`/compare/${commit}...${tip}`)).data
	);
	if (
		!['ahead', 'identical'].includes(comparison.status) ||
		comparison.merge_base_commit.sha !== commit
	)
		return fail('unreachable-anchor');
}

export { githubHistory } from './create-git-hub-source/githubHistory';
