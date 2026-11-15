// @harness-uid u_qfigvyo5j5
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { digest } from './batch';
import type { VideoArchiveRead } from '../VideoArchiveService.types';

/** Only verified, hash-derived relative media names are materialized; existing bytes are immutable. */
export async function restoreVideoBatch(
	read: VideoArchiveRead,
	directory: string,
	root: string
): Promise<void> {
	const local = relative(resolve(root), resolve(directory));
	if (isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`))
		throw new ExpectedCliError('Video restore directory must be inside its repository.');
	const base = await realpath(root),
		target = join(base, local);
	await safeDirectory(base, local);
	await safeDirectory(base, join(local, 'media'));
	for (const [path, bytes] of read.files) {
		if (!/^media\/[a-f0-9]{64}\.(mp4|png)$/.test(path))
			throw new ExpectedCliError('Unsafe restored video path.');
		await restoreFile(join(target, path), bytes);
	}
}

async function safeDirectory(base: string, local: string): Promise<void> {
	let path = base;
	for (const part of local.split(sep).filter(Boolean)) {
		path = join(path, part);
		await mkdir(path).catch((error: { code?: string }) => {
			if (error.code !== 'EEXIST') throw error;
		});
		const stat = await lstat(path);
		if (!stat.isDirectory() || stat.isSymbolicLink())
			throw new ExpectedCliError('Video restore directory is a symlink or not a directory.');
	}
}

async function restoreFile(path: string, bytes: Buffer): Promise<void> {
	const file = await open(
		path,
		constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW
	).catch((error: { code?: string }) => {
		if (error.code !== 'EEXIST') throw error;
		return undefined;
	});
	if (file) {
		try {
			await file.writeFile(bytes);
			await file.sync();
		} finally {
			await file.close();
		}
	}
	const retained = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => {
		throw new ExpectedCliError('Video restore conflict or symlink.');
	});
	try {
		const stat = await retained.stat();
		if (!stat.isFile() || stat.size !== bytes.length)
			throw new ExpectedCliError('Video restore conflict with different bytes.');
		const actual = Buffer.alloc(bytes.length),
			result = await retained.read(actual, 0, actual.length, 0);
		if (result.bytesRead !== bytes.length || digest(actual) !== digest(bytes))
			throw new ExpectedCliError('Video restore conflict with different bytes.');
	} finally {
		await retained.close();
	}
}
