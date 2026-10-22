import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const consoleManifestFile = 'harness.console.json';

export interface ConsoleFileEntry {
	path: string;
	/** Content the file had when this record was written. */
	sha256: string;
	/** `harness` wrote it and may rewrite it; `host` keeps its own version. */
	owner: 'harness' | 'host';
}

export interface FileIdentity {
	sha256: string;
	bytes: number;
}

/** One file the installer changed although it held other content, and where that content is. */
export interface ConsoleChange {
	path: string;
	action: 'replaced' | 'removed' | 'restored';
	reason: string;
	at: string;
	/** What the file held before, and the project-local copy it can be restored from. */
	before: FileIdentity & { saved: string };
	/** What it holds now; null when the file was removed. */
	after: FileIdentity | null;
}

/** Where the installed console reads history from. */
export type ConsoleStorage =
	| { kind: 'bundle' }
	| { kind: 'bucket'; binding: string; prefix: string };

export interface ConsoleManifest {
	schemaVersion: 1;
	base?: string;
	policy?: { module: string; export: string };
	storage?: ConsoleStorage;
	files: ConsoleFileEntry[];
	/** Every replacement, removal and restore, oldest first; entries are never rewritten. */
	changes: ConsoleChange[];
}

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
