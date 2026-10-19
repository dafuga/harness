import { GitHubTransport, readRef } from '../githubTransport';
import { fail } from '../parseCollaborationInput';

export async function exactRef(client: GitHubTransport, ref: string): Promise<string> {
	return (await readRef(client, ref)) ?? fail('not-found');
}
