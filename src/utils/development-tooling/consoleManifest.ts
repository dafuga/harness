import type { ConsoleManifest } from './consoleManifest.types';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const consoleManifestFile = 'harness.console.json';

/** The record a host keeps of the console install; empty when nothing was installed yet. */
export async function consoleManifest(host: string): Promise<ConsoleManifest> {
	const text = await readFile(join(host, consoleManifestFile), 'utf8').catch(() => undefined);
	const stored = text ? (JSON.parse(text) as Partial<ConsoleManifest>) : {};
	const files = (stored.files ?? []).map((file) => ({ ...file, owner: file.owner ?? 'harness' }));
	return { ...stored, schemaVersion: 1, files, changes: stored.changes ?? [] };
}

export async function writeConsoleManifest(host: string, manifest: ConsoleManifest): Promise<void> {
	const files = [...manifest.files].sort((left, right) => (left.path < right.path ? -1 : 1));
	const text = `${JSON.stringify({ ...manifest, files }, null, '\t')}\n`;
	await writeFile(join(host, consoleManifestFile), text);
}

export type {
	ConsoleFileEntry,
	FileIdentity,
	ConsoleChange,
	ConsoleStorage,
	ConsoleManifest
} from './consoleManifest.types';
