import { z } from 'zod';
import type { GitHubTransport } from '../githubTransport';
import { base64 } from '../githubTransport';
import { parse, sha } from '../../planning-collaboration/parseCollaborationInput';

export async function commitRecords(
	client: GitHubTransport,
	input: { parent: string | null; path: string; records: unknown }
): Promise<string> {
	const parent = input.parent
		? parse(
				z.object({ tree: z.object({ sha }) }),
				(await client.request(`/git/commits/${input.parent}`)).data
			)
		: null;
	const blob = parse(
		z.object({ sha }),
		(
			await client.request('/git/blobs', {
				method: 'POST',
				body: {
					encoding: 'base64',
					content: base64(new TextEncoder().encode(JSON.stringify(input.records)))
				}
			})
		).data
	);
	const tree = parse(
		z.object({ sha }),
		(
			await client.request('/git/trees', {
				method: 'POST',
				body: {
					...(parent ? { base_tree: parent.tree.sha } : {}),
					tree: [{ path: input.path, mode: '100644', type: 'blob', sha: blob.sha }]
				}
			})
		).data
	);
	const commit = parse(
		z.object({ sha }),
		(
			await client.request('/git/commits', {
				method: 'POST',
				body: {
					message: 'Update private collaboration records',
					tree: tree.sha,
					parents: input.parent ? [input.parent] : []
				}
			})
		).data
	);
	return commit.sha;
}
