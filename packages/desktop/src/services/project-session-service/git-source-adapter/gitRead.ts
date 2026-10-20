import { gitRead, gitRevision } from '../../../utils/gitRead';

export async function gitFiles(root: string, revision: string): Promise<string[]> {
	return (await gitRead(root, ['ls-tree', '-rz', '--name-only', await gitRevision(root, revision)]))
		.split('\0')
		.filter(Boolean);
}
