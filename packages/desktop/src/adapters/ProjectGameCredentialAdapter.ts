import { readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { gitRead } from '../utils/gitRead';
export type GameCredentialName = 'HARNESS_GAME_OPENAI_API_KEY' | 'HARNESS_GAME_DECART_API_KEY';
const credentialFile = '.env.local';

/** Read only a project-owned ignored regular file; never ambient provider credentials. */
export class ProjectGameCredentialAdapter {
	constructor(private readonly root: string) {}

	async read(name: GameCredentialName): Promise<string> {
		const file = join(this.root, credentialFile);
		const stat = await lstat(file).catch(() => undefined);
		if (!stat) throw unconfigured(name);
		if (!(await this.ignored(name))) throw new Error('Credential file must be ignored.');
		if (!stat.isFile() || stat.isSymbolicLink())
			throw new Error('Credential file must be regular.');
		const text = await readFile(file, 'utf8').catch(() => '');
		const key = text.match(new RegExp('^' + name + '=["\']?([^\\s"\']+)["\']?\\s*$', 'm'))?.[1];
		if (key) return key;
		/* Do not borrow another project or ambient environment credentials. */
		throw unconfigured(name);
	}

	/** Untracked and ignored by this project's Git; any other Git failure is not configured. */
	private async ignored(name: GameCredentialName): Promise<boolean> {
		try {
			if ((await gitRead(this.root, ['ls-files', '--', credentialFile])).trim()) return false;
			return Boolean((await gitRead(this.root, ['check-ignore', credentialFile])).trim());
		} catch (error) {
			if ((error as { code?: unknown }).code === 1) return false;
			throw unconfigured(name);
		}
	}
}

function unconfigured(name: GameCredentialName): Error {
	return new Error('Configure a project-owned ' + name + ' in this project’s ignored .env.local.');
}
