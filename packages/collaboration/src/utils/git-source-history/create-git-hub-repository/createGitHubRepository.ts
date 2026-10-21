import { z } from 'zod';
import type {
	CollaborationRepository,
	GitHubRepositoryOptions,
	CollaborationRecords
} from '../../../models/planning-collaboration/Collaboration.types';
import type { GitHubTransport } from '../githubTransport';
import { fail, parse, safePath, sha } from '../../planning-collaboration/parseCollaborationInput';
import { recordsSchema } from '../../development-tooling/recordsSchema';
import { decode64, readRef, githubTransport, refPath } from '../githubTransport';
import { commitRecords } from './commitRecords';

const absent = '0'.repeat(40);

function empty(revision: string) {
	return {
		revision,
		records: { schemaVersion: 1 as const, projects: [], members: [], invitations: [], threads: [] }
	};
}

type Context = { client: GitHubTransport; ref: string; path: string };

async function readRecords(context: Context) {
	const { client, ref, path } = context;
	await client.check(true);
	const revision = await readRef(client, ref);
	if (!revision) return empty(absent);
	const response = await client.request(
		`/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${revision}`,
		{ statuses: [404] }
	);
	if (response.status === 404) return empty(revision);
	const body = parse(
		z.object({ type: z.literal('file'), encoding: z.literal('base64'), content: z.string() }),
		response.data
	);
	try {
		return {
			revision,
			records: parse(
				recordsSchema,
				JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode64(body.content)))
			)
		};
	} catch {
		return fail('invalid-records');
	}
}

async function compareAndSwap(context: Context, expected: string, records: CollaborationRecords) {
	const { client, ref, path } = context;
	parse(sha, expected);
	parse(recordsSchema, records);
	await client.check(true);
	const parent = expected === absent ? null : expected;
	if ((await readRef(client, ref)) !== parent) return null;
	const commit = await commitRecords(client, { parent, path, records });
	const response = await client.request(parent ? `/git/refs/${refPath(ref)}` : '/git/refs', {
		method: parent ? 'PATCH' : 'POST',
		body: parent ? { sha: commit, force: false } : { ref, sha: commit },
		statuses: [409, 422]
	});
	if (response.data === null) {
		if ((await readRef(client, ref)) !== parent) return null;
		return fail('github-unavailable');
	}
	const accepted = parse(z.object({ ref: z.string(), object: z.object({ sha }) }), response.data);
	if (accepted.ref !== ref || accepted.object.sha !== commit) return fail('write-unconfirmed');
	return commit;
}

export function createGitHubRepository(options: GitHubRepositoryOptions): CollaborationRepository {
	const client = githubTransport(options, 'write');
	if (!options.repository.private || !options.ref.startsWith('refs/heads/'))
		return fail('private-storage-required');
	const context = { client, path: safePath(options.path), ref: options.ref };
	refPath(options.ref);
	return {
		read: () => readRecords(context),
		compareAndSwap: (expected, records) => compareAndSwap(context, expected, records)
	};
}
