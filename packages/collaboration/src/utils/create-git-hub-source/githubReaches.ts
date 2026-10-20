import { z } from 'zod';
import type { GitHubTransport } from '../githubTransport';
import { parse, sha } from '../parseCollaborationInput';

const comparison = z.object({
	status: z.enum(['ahead', 'behind', 'identical', 'diverged']),
	merge_base_commit: z.object({ sha })
});

/**
 * True when `commit` is `tip` or one of its ancestors. A commit the repository does not hold is
 * reached by nothing; a repository that cannot be asked is a failure and never an answer.
 */
export async function githubReaches(
	client: GitHubTransport,
	input: { tip: string; commit: string }
): Promise<boolean> {
	const tip = parse(sha, input.tip),
		commit = parse(sha, input.commit);
	if (commit === tip) return true;
	await client.check();
	const response = await client.request(`/compare/${commit}...${tip}`, { statuses: [404] });
	if (response.status === 404) return false;
	const compared = parse(comparison, response.data);
	return (
		['ahead', 'identical'].includes(compared.status) && compared.merge_base_commit.sha === commit
	);
}
