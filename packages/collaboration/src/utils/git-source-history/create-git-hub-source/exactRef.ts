import type { GitHubTransport } from '../githubTransport';
import { readRef } from '../githubTransport';
import { fail } from '../../planning-collaboration/parseCollaborationInput';

export async function exactRef(client: GitHubTransport, ref: string): Promise<string> {
	return (await readRef(client, ref)) ?? fail('not-found');
}
