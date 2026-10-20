import { z } from 'zod';
import type {
	RepositoryIdentity,
	SourceAdapter,
	SourceHistoryPageInput,
	SourceHistoryPage
} from '../../models/Collaboration.types';
import type { GitHubTransport } from '../githubTransport';
import { parse, safePath, sha } from '../parseCollaborationInput';

const record = z.object({
	sha,
	commit: z.object({
		message: z.string(),
		author: z.object({ date: z.string() }).nullable(),
		committer: z.object({ date: z.string() })
	})
});

const inputSchema = z
	.object({
		commit: sha,
		paths: z.array(z.string()).max(64),
		page: z.number().int().min(1).default(1),
		perPage: z.number().int().min(1).max(100).default(30)
	})
	.strict();

export async function githubHistoryPage(
	context: { adapter: SourceAdapter; client: GitHubTransport },
	repository: RepositoryIdentity,
	input: SourceHistoryPageInput
): Promise<SourceHistoryPage> {
	const value = parse(inputSchema, input);
	const paths = [...new Set(value.paths.map(safePath))];
	await context.adapter.resolve(repository, value.commit);
	const commits = new Map<string, SourceHistoryPage['commits'][number]>();
	let complete = true;
	for (let offset = 0; offset < paths.length; offset += 4) {
		const results = await Promise.all(
			paths
				.slice(offset, offset + 4)
				.map((path) =>
					context.client.request(
						`/commits?sha=${value.commit}&path=${encodeURIComponent(path)}&per_page=${value.perPage}&page=${value.page}`
					)
				)
		);
		for (const result of results) {
			if (result.hasNext) complete = false;
			for (const item of parse(z.array(record), result.data))
				commits.set(item.sha, {
					hash: item.sha,
					subject: item.commit.message.split('\n')[0],
					authoredAt: item.commit.author?.date ?? item.commit.committer.date
				});
		}
	}
	return { commits: [...commits.values()], complete, nextPage: complete ? null : value.page + 1 };
}
