import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join, parse, resolve } from 'node:path';
import type {
	BrokerFileWrite,
	ModuleTaskToolBrokerScope
} from '../../adapters/agents-providers/ModuleTaskToolBrokerAdapter.types';

const limit = 1024 * 1024;
const pending = new Map<string, Promise<unknown>>();
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** @pure */
export function moduleTaskBrokerFiles(textToFormat: string): string {
	if (typeof textToFormat !== 'string') throw new TypeError('moduleTaskBrokerFiles expects text');
	return textToFormat.trim();
}

function assignedPath(scope: ModuleTaskToolBrokerScope, path: string): string {
	if (typeof path !== 'string' || !scope.files.includes(path) || isAbsolute(path))
		throw new Error('File is not assigned');
	if (path.includes('\\') || path.split('/').some((part) => !part || part === '.' || part === '..'))
		throw new Error('Noncanonical assigned path');
	if (!isAbsolute(scope.root) || resolve(scope.root) !== scope.root)
		throw new Error('Noncanonical task root');
	return join(scope.root, path);
}

async function checkPath(path: string): Promise<void> {
	const root = parse(path).root;
	let current = root;
	for (const part of path.slice(root.length).split('/')) {
		if (!(await readdir(current)).includes(part)) throw new Error('Path spelling mismatch');
		current = join(current, part);
		const stat = await lstat(current);
		if (stat.isSymbolicLink() || (current !== path && !stat.isDirectory()))
			throw new Error('Unsafe path ancestor');
	}
	if ((await realpath(path)) !== path) throw new Error('Noncanonical file');
}

async function verifyHandle(path: string, handle: FileHandle): Promise<void> {
	await checkPath(path);
	const [named, opened] = await Promise.all([lstat(path), handle.stat()]);
	if (
		!named.isFile() ||
		!opened.isFile() ||
		named.nlink !== 1 ||
		opened.nlink !== 1 ||
		named.dev !== opened.dev ||
		named.ino !== opened.ino ||
		opened.size > limit
	)
		throw new Error('Unsafe assigned file handle');
}

async function fileBytes(handle: FileHandle): Promise<Buffer> {
	const buffer = Buffer.alloc(limit + 1);
	let size = 0;
	while (size < buffer.length) {
		const result = await handle.read(buffer, size, buffer.length - size, size);
		if (!result.bytesRead) break;
		size += result.bytesRead;
	}
	if (size > limit) throw new Error('Assigned file exceeds 1 MiB');
	return buffer.subarray(0, size);
}

async function withFile<T>(
	path: string,
	write: boolean,
	action: (handle: FileHandle) => Promise<T>
) {
	await checkPath(path);
	const before = await lstat(path);
	if (!before.isFile() || before.nlink !== 1) throw new Error('Unsafe assigned file');
	const handle = await open(
		path,
		(write ? constants.O_RDWR : constants.O_RDONLY) | constants.O_NOFOLLOW
	);
	try {
		await verifyHandle(path, handle);
		return await action(handle);
	} finally {
		await handle.close();
	}
}

export async function readBrokerFile(scope: ModuleTaskToolBrokerScope, path: string) {
	const target = assignedPath(scope, path);
	return withFile(target, false, async (handle) => {
		const bytes = await fileBytes(handle);
		await verifyHandle(target, handle);
		return {
			text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes),
			sha256: digest(bytes)
		};
	});
}

function writeBytes(input: BrokerFileWrite): Buffer {
	if (!/^[a-f0-9]{64}$/.test(input.expectedSha256) || typeof input.text !== 'string')
		throw new Error('Expected SHA-256 and UTF-8 text required');
	const bytes = Buffer.from(input.text, 'utf8');
	if (
		bytes.length > limit ||
		new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== input.text
	)
		throw new Error('Invalid or excessive UTF-8 text');
	return bytes;
}

async function replaceFile(target: string, input: BrokerFileWrite, bytes: Buffer) {
	return withFile(target, true, async (handle) => {
		if (digest(await fileBytes(handle)) !== input.expectedSha256)
			throw new Error('Stale expected SHA-256');
		await verifyHandle(target, handle);
		let offset = 0;
		while (offset < bytes.length) {
			const result = await handle.write(bytes, offset, bytes.length - offset, offset);
			if (!result.bytesWritten) throw new Error('Incomplete file write');
			offset += result.bytesWritten;
		}
		await handle.truncate(bytes.length);
		await handle.sync();
		await verifyHandle(target, handle);
		return { sha256: digest(bytes) };
	});
}

export async function writeBrokerFile(scope: ModuleTaskToolBrokerScope, input: BrokerFileWrite) {
	const target = assignedPath(scope, input.path);
	const bytes = writeBytes(input);
	const previous = pending.get(target) ?? Promise.resolve();
	const operation = previous.catch(() => undefined).then(() => replaceFile(target, input, bytes));
	pending.set(target, operation);
	try {
		return await operation;
	} finally {
		if (pending.get(target) === operation) pending.delete(target);
	}
}
