import type { ApiSession } from './ApiSessionRepository.types';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fail } from '../../../core/development-tooling/errors';

/** Local session credentials are private and bound to the exact server origin. */
export class ApiSessionRepository {
	private path: string;
	constructor(
		private origin: string,
		private directory = process.env.HARNESS_API_HOME ?? join(homedir(), '.codex/harness/api')
	) {
		this.path = join(directory, createHash('sha256').update(origin).digest('hex') + '.json');
	}
	async load(): Promise<string | undefined> {
		const info = await lstat(this.path).catch((cause: unknown) => {
			if ((cause as { code?: string }).code === 'ENOENT') return undefined;
			return fail('The local API session could not be read.');
		});
		if (!info) return undefined;
		if (!info.isFile() || info.mode & 0o077 || info.uid !== process.getuid?.())
			fail('The local API session must be an owner-only regular file.');
		const session = await this.read();
		if (session.origin !== this.origin || typeof session.token !== 'string' || !session.token)
			fail('The local API session does not match this server; reconnect explicitly.');
		return session.token;
	}
	private async read(): Promise<ApiSession> {
		try {
			return JSON.parse(await readFile(this.path, 'utf8')) as ApiSession;
		} catch {
			return fail('The local API session is unreadable; reconnect explicitly.');
		}
	}
	async ensure(create: () => Promise<string>): Promise<string> {
		const saved = await this.load();
		if (saved) return saved;
		await mkdir(this.directory, { recursive: true, mode: 0o700 });
		for (let attempt = 0; attempt < 300; attempt++) {
			const lock = await this.lock();
			if (lock) {
				try {
					const token = (await this.load()) ?? (await create());
					await this.save(token);
					return token;
				} finally {
					await lock.close();
					await rm(this.path + '.lock', { force: true });
				}
			}
			await delay(100);
			const token = await this.load();
			if (token) return token;
		}
		return fail(
			'A local API connection is still pending; use api connect to recover an interrupted connection.'
		);
	}
	private async lock() {
		try {
			return await open(this.path + '.lock', 'wx', 0o600);
		} catch (cause) {
			if ((cause as { code?: string }).code === 'EEXIST') return null;
			return fail('The local API session lock could not be created.');
		}
	}
	async save(token: string): Promise<void> {
		await mkdir(this.directory, { recursive: true, mode: 0o700 });
		const temporary = this.path + '.' + randomUUID();
		try {
			await writeFile(temporary, JSON.stringify({ origin: this.origin, token }), {
				mode: 0o600,
				flag: 'wx'
			});
			await rename(temporary, this.path);
		} finally {
			await rm(temporary, { force: true });
		}
	}
	async forget(): Promise<void> {
		await rm(this.path, { force: true });
	}
}
