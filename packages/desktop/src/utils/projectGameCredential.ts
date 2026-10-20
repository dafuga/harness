import { readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { gitRead } from './gitRead';
/** Read only a project-owned ignored regular file; never ambient provider credentials. */
export async function projectGameCredential(
	root: string,
	name: 'HARNESS_GAME_OPENAI_API_KEY' | 'HARNESS_GAME_DECART_API_KEY'
): Promise<string> {
	try {
		const tracked = (await gitRead(root, ['ls-files', '--', '.env.local'])).trim();
		const ignored = (await gitRead(root, ['check-ignore', '.env.local'])).trim();
		if (tracked || !ignored) throw new Error('Credential file must be ignored.');
		const file = join(root, '.env.local'),
			stat = await lstat(file);
		if (!stat.isFile() || stat.isSymbolicLink())
			throw new Error('Credential file must be regular.');
		const text = await readFile(file, 'utf8');
		const key = text.match(new RegExp('^' + name + '=["\']?([^\\s"\']+)["\']?\\s*$', 'm'))?.[1];
		if (key) return key;
	} catch {
		/* Do not borrow another project or ambient environment credentials. */
	}
	throw new Error('Configure a project-owned ' + name + ' in this project’s ignored .env.local.');
}
