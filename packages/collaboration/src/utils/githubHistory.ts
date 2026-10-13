import { z } from 'zod';
import { githubCommitFacts } from './githubCommitFacts';
import { githubHistoryPage } from './githubHistoryPage';
import { githubReaches } from './githubReaches';
import type {
	GitHubOptions,
	RepositoryIdentity,
	SourceAdapter,
	SourceHistoryAdapter
} from '../models/Collaboration.types';
import type { GitHubTransport } from './githubTransport';
import { githubTransport, readRef } from './githubTransport';
import { branch, fail, parse, sha } from './parseCollaborationInput';
async function pages<T>(client: GitHubTransport, path: string, schema: z.ZodType<T>): Promise<T[]> {
	const values: T[] = [];
	for (let page = 1; page <= 100; page++) {
		const items = parse(
			z.array(schema),
			(await client.request(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`))
				.data
		);
		values.push(...items);
		if (items.length < 100) return values;
	}
	return fail('history-limit');
}
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
async function commits(
	adapter: SourceAdapter,
	client: GitHubTransport,
	repository: RepositoryIdentity,
	input: { branch: string; commit?: string }
) {
	const tip = await adapter.resolve(repository, `refs/heads/${parse(branch, input.branch)}`);
	const commit = input.commit ? parse(sha, input.commit) : tip.commit;
	await ensureAncestry(client, commit, tip.commit);
	const records = await pages(
		client,
		`/commits?sha=${commit}`,
		z.object({
			sha,
			commit: z.object({
				message: z.string(),
				author: z.object({ date: z.string() }).nullable(),
				committer: z.object({ date: z.string() })
			})
		})
	);
	return records.map((record) => ({
		hash: record.sha,
		subject: record.commit.message.split('\n')[0],
		authoredAt: record.commit.author?.date ?? record.commit.committer.date
	}));
}
async function changed(
	adapter: SourceAdapter,
	client: GitHubTransport,
	repository: RepositoryIdentity,
	commit: string
) {
	parse(sha, commit);
	const after = await adapter.tree(repository, commit);
	const info = parse(
		z.object({ parents: z.array(z.object({ sha })) }),
		(await client.request(`/git/commits/${commit}`)).data
	);
	const before = info.parents[0] ? await adapter.tree(repository, info.parents[0].sha) : [];
	const entries = (items: typeof after) =>
		new Map(items.filter((e) => e.type !== 'tree').map((e) => [e.path, `${e.sha}:${e.mode}`]));
	const old = entries(before),
		next = entries(after);
	return [...new Set([...old.keys(), ...next.keys()])]
		.filter((path) => old.get(path) !== next.get(path))
		.sort();
}
async function optionalRef(
	adapter: SourceAdapter,
	client: GitHubTransport,
	repository: RepositoryIdentity,
	ref: string
) {
	const commit = await readRef(client, ref);
	return commit ? adapter.resolve(repository, commit) : null;
}
export function githubHistory(
	adapter: SourceAdapter,
	options: Omit<GitHubOptions, 'repository'>
): Omit<SourceHistoryAdapter, keyof SourceAdapter | 'raw' | 'rawMany'> {
	const client = (repository: RepositoryIdentity) =>
		githubTransport({ ...options, repository }, 'read');
	return {
		historyPage: (repository, input) =>
			githubHistoryPage({ adapter, client: client(repository) }, repository, input),
		async branches(repository) {
			const api = client(repository);
			await api.check();
			const values = await pages(
				api,
				'/branches',
				z.object({ name: branch, commit: z.object({ sha }) })
			);
			return values.map((value) => ({ name: value.name, tip: value.commit.sha }));
		},
		commits: (repository, input) => commits(adapter, client(repository), repository, input),
		changed: (repository, commit) => changed(adapter, client(repository), repository, commit),
		async optionalRef(repository, ref) {
			const api = client(repository);
			await api.check();
			return optionalRef(adapter, api, repository, ref);
		},
		facts: (repository, commit) => githubCommitFacts(client(repository), commit),
		reaches: (repository, input) => githubReaches(client(repository), input)
	};
}
