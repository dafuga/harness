// @harness-uid u_gvqtr5mdwv
import {
	chmodSync,
	linkSync,
	lstatSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	statSync,
	unlinkSync
} from 'node:fs';
import type { Stats } from 'node:fs';
import { createServer } from 'node:net';
import { basename, dirname, join } from 'node:path';
import { TrackerNodeStartupError } from './TrackerNodeStartupError';

export async function holdLegacySupervisorSocket(path: string): Promise<() => Promise<void>> {
	const parent = verifyPrivateSocketDirectory(path);
	const temporary = mkdtempSync(join(parent, '.t-'));
	const socketPath = join(temporary, 's');
	const server = createServer((socket) => {
		socket.on('error', () => {});
		socket.end(`${process.pid}\n`);
	});
	const close = () =>
		new Promise<void>((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
		});
	try {
		await new Promise<void>((resolve, reject) => {
			server.once('error', reject);
			server.listen(socketPath, () => {
				server.removeListener('error', reject);
				resolve();
			});
		});
		chmodSync(socketPath, 0o600);
		const identity = lstatSync(socketPath);
		// Bun can replace an existing Unix socket when binding. Link the bound
		// socket into place atomically and leave any incumbent inode untouched.
		linkSync(socketPath, path);
		return async () => {
			try {
				await close();
			} finally {
				try {
					releaseSocket(path, identity);
				} finally {
					rmSync(temporary, { recursive: true, force: true });
				}
			}
		};
	} catch (error) {
		try {
			if (server.listening) await close();
		} finally {
			rmSync(temporary, { recursive: true, force: true });
		}
		throw error;
	}
}

function verifyPrivateSocketDirectory(path: string): string {
	const parent = dirname(path);
	const owner = statSync(parent);
	if (
		join(realpathSync(parent), basename(path)) !== path ||
		!owner.isDirectory() ||
		owner.uid !== process.getuid?.() ||
		(owner.mode & 0o077) !== 0
	)
		throw new TrackerNodeStartupError(
			'Tracker supervisor socket needs a canonical private directory'
		);
	return parent;
}

function releaseSocket(path: string, identity: Stats): void {
	try {
		const current = lstatSync(path);
		if (current.dev === identity.dev && current.ino === identity.ino) unlinkSync(path);
	} catch (error) {
		if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
	}
}
