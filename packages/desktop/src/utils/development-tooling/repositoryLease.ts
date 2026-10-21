import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
export type RepositoryLease = (() => Promise<void>) & { signal: AbortSignal };
/** OS advisory lock shared across Web and Electron. A lost helper aborts its protected run. */
async function advisoryLease(root: string): Promise<RepositoryLease | null> {
	if (!['darwin', 'linux'].includes(process.platform))
		throw new Error('Cross-app repository locking is not supported on this platform.');
	const directory = join(tmpdir(), `harness-runs-${process.getuid?.() ?? 'owner'}`);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const file = join(directory, createHash('sha256').update(root).digest('hex'));
	const command = process.platform === 'darwin' ? '/usr/bin/lockf' : 'flock';
	const args = process.platform === 'darwin' ? ['-k', '-t', '0', file] : ['-n', file];
	return new Promise((resolve, reject) => {
		const child = spawn(command, [...args, '/bin/sh', '-c', 'printf held; cat >/dev/null'], {
			stdio: ['pipe', 'pipe', 'ignore']
		});
		let held = false,
			closing = false;
		const lost = new AbortController();
		const release = (): Promise<void> => {
			closing = true;
			const done =
				child.exitCode !== null || child.signalCode !== null
					? Promise.resolve()
					: new Promise<void>((finish) => child.once('exit', () => finish()));
			child.stdin.end();
			return done;
		};
		child.once('error', (cause) => {
			lost.abort(cause);
			if (!held) reject(cause);
		});
		child.stdin.on('error', () => {
			if (!closing) lost.abort(new Error('Project lock pipe closed.'));
		});
		child.stdout.once('data', () => {
			held = true;
			resolve(Object.assign(release, { signal: lost.signal }));
		});
		child.once('exit', () => {
			if (!held) resolve(null);
			else if (!closing) {
				child.stdin.end();
				lost.abort(new Error('Project lock was lost.'));
			}
		});
	});
}

/** The parent marker fences planning writes even if the advisory-lock helper exits early. */
export async function repositoryLease(root: string): Promise<RepositoryLease | null> {
	const lease = await advisoryLease(root);
	if (!lease) return null;
	const file = join(
		tmpdir(),
		`harness-runs-${process.getuid?.() ?? 'owner'}`,
		createHash('sha256').update(root).digest('hex') + '.owner'
	);
	const owner = `${process.pid}:${crypto.randomUUID()}`;
	try {
		const prior = await readFile(file, 'utf8').catch((cause) => {
			if (cause.code === 'ENOENT') return '';
			throw cause;
		});
		if (prior && ownerAlive(prior)) {
			await lease();
			return null;
		}
		await writeFile(file, owner, { mode: 0o600 });
		return Object.assign(
			async () => {
				try {
					if ((await readFile(file, 'utf8')) === owner) await unlink(file);
				} finally {
					await lease();
				}
			},
			{ signal: lease.signal }
		);
	} catch (cause) {
		await lease();
		throw cause;
	}
}
function ownerAlive(owner: string): boolean {
	const pid = Number(owner.split(':')[0]);
	if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid project lock owner.');
	try {
		process.kill(pid, 0);
		return true;
	} catch (cause) {
		if ((cause as NodeJS.ErrnoException).code === 'ESRCH') return false;
		throw cause;
	}
}
