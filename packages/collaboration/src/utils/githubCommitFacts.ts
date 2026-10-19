import { z } from 'zod';
import type { SourceCommitFacts } from '../models/Collaboration.types';
import type { GitHubTransport } from './githubTransport';
import { fail, parse, sha } from './parseCollaborationInput';

const signed = z.object({ name: z.string(), date: z.string() });
const stated = z.object({
	sha,
	tree: z.object({ sha }),
	parents: z.array(z.object({ sha })),
	message: z.string(),
	author: signed,
	committer: signed
});

/** The title of a commit as Git gives it: its first paragraph on one line. */
function subject(message: string): string {
	const [first = ''] = message.trim().split(/\n[ \t]*\n/);
	return first.replace(/\s*\n\s*/g, ' ');
}

/**
 * One commit as the repository states it: its tree, its parents in their order, its title, who
 * wrote it and when it was committed. Null when the repository holds no such commit; an answer
 * for another commit than the one asked for is refused.
 */
export async function githubCommitFacts(
	client: GitHubTransport,
	commit: string
): Promise<SourceCommitFacts | null> {
	parse(sha, commit);
	await client.check();
	const response = await client.request(`/git/commits/${commit}`, { statuses: [404] });
	if (response.status === 404) return null;
	const value = parse(stated, response.data);
	if (value.sha !== commit) return fail('commit-mismatch');
	return {
		commit,
		tree: value.tree.sha,
		parents: value.parents.map((parent) => parent.sha),
		subject: subject(value.message),
		author: value.author.name,
		committedAt: value.committer.date
	};
}
