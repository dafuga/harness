import type { GitHubTransport } from '../githubTransport';
import { readRef } from '../githubTransport';
import { fail } from '../parseCollaborationInput';

export async function exactRef(client: GitHubTransport, ref: string): Promise<string> {
	return (await readRef(client, ref)) ?? fail('not-found');
}
