import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { z } from 'zod';

const receipt = z.discriminatedUnion('kind', [
	z.object({
		kind: z.enum(['tab', 'window']),
		browser: z.string().uuid(),
		target: z
			.string()
			.regex(/^[a-f0-9]{32}$/i)
			.optional()
	}),
	z.object({ kind: z.literal('simulator'), udid: z.string().uuid().optional() }),
	z.object({
		kind: z.literal('container'),
		host: z.string().regex(/^unix:\/\/\/[^\r\n]+$/),
		daemon: z.string().regex(/^[a-z0-9:-]{12,128}$/i)
	}),
	z.object({
		kind: z.literal('process'),
		pid: z.int().positive().optional(),
		start: z.string().optional()
	})
]);

export function hygieneDirectory(): string {
	const path = process.env.HARNESS_TRACKER_HYGIENE;
	if (!path || !isAbsolute(path)) throw new Error('This command requires a managed Tracker run.');
	const info = lstatSync(path);
	if (!info.isDirectory() || info.uid !== process.getuid?.() || info.mode & 0o077)
		throw new Error('The run resource ledger must be a private directory.');
	return path;
}

export function beginResource(value: z.infer<typeof receipt>): string {
	const directory = hygieneDirectory();
	const id = randomUUID();
	if (isClosing(directory)) throw new Error('The Tracker run is closing.');
	const entry = join(directory, id);
	mkdirSync(entry, { mode: 0o700 });
	saveResource(entry, value);
	if (isClosing(directory)) {
		writeFileSync(join(entry, 'closed'), '', { mode: 0o600 });
		throw new Error('The Tracker run is closing.');
	}
	return entry;
}

export function saveResource(path: string, value: z.infer<typeof receipt>) {
	writeHygieneJson(join(path, 'resource.json'), value);
}

export function writeHygieneJson(target: string, value: unknown) {
	const temporary = target + '.' + randomUUID();
	writeFileSync(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
	renameSync(temporary, target);
}

export function readResource(path: string) {
	const directory = lstatSync(path);
	const file = join(path, 'resource.json');
	const info = lstatSync(file);
	if (
		!directory.isDirectory() ||
		directory.uid !== process.getuid?.() ||
		directory.mode & 0o077 ||
		!info.isFile() ||
		info.nlink !== 1 ||
		info.uid !== process.getuid?.() ||
		info.mode & 0o077 ||
		info.size > 8192
	)
		throw new Error('Invalid run resource receipt.');
	return receipt.parse(JSON.parse(readFileSync(file, 'utf8')));
}

export function isClosing(path: string) {
	return existsSync(join(path, 'closing'));
}

export function markResource(path: string, name: 'ready' | 'closed' | 'closing') {
	writeFileSync(join(path, name), '', { mode: 0o600 });
}
