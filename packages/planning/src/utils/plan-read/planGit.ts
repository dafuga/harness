import { Git } from '../planGit';
import { fail } from "../planData";

export async function containing(git: Git, rev: string, path: string): Promise<string> {
	return (
		(await git.run(['log', '--format=%H', '--diff-filter=A', rev, '--', path]))
			.toString()
			.trim()
			.split('\n')
			.at(-1) || fail('artifact-tampered', 'Artifact has no creation commit')
	);
}
