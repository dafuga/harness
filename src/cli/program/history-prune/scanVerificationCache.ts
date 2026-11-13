// @harness-uid u_hprnscannr
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { VerificationRecord } from '../../../core/verification-evidence/verificationTypes';
import { captureIndex } from '../../../core/verification-evidence/verifyTypes';
import { VerificationRecordValidator } from '../../../validators/verification-evidence/VerificationRecordValidator';
import { recordFiles } from '../../../utils/verification-evidence/evidenceManifest';
import type { CacheScanContext, PruneInventoryEntry } from './previewHistoryPrune.types';
import { scanCacheTree } from './scanCacheTree';

export async function scanVerificationCache(root: string, store: string) {
	const context: CacheScanContext = { root, store, entries: [], valid: [], problems: [] };
	if (!(await safeStore(context))) return context;
	const listing = await listNames(store);
	if (!listing.names) {
		context.problems.push(`Could not list the verification cache: ${listing.problem}`);
		return context;
	}
	for (const name of listing.names.sort()) await scanCommit(context, name);
	return context;
}

async function safeStore(context: CacheScanContext): Promise<boolean> {
	const directories = [
		join(context.root, '.cache'),
		join(context.root, '.cache', 'harness'),
		context.store
	];
	for (const directory of directories) {
		const state = await lstatOrError(directory);
		if (state === undefined) return false;
		if (state instanceof Error) {
			context.entries.push(protectedEntry(context, directory, `cannot inspect: ${message(state)}`));
			return false;
		}
		if (state.isSymbolicLink() || !state.isDirectory()) {
			const reason = state.isSymbolicLink()
				? 'symlink ancestor is not traversed'
				: 'expected a directory';
			context.entries.push(protectedEntry(context, directory, reason));
			return false;
		}
	}
	return true;
}

async function scanCommit(context: CacheScanContext, commitName: string): Promise<void> {
	const path = join(context.store, commitName);
	const state = await lstatOrError(path);
	if (state === undefined) return;
	if (state instanceof Error) {
		context.problems.push(`Could not inspect ${relative(context.root, path)}: ${message(state)}`);
		return;
	}
	if (state.isSymbolicLink() || !state.isDirectory()) {
		const reason = state.isSymbolicLink()
			? 'symlink is not traversed'
			: 'unregistered cache entry; expected a commit directory';
		context.entries.push(protectedEntry(context, path, reason));
		return;
	}
	const runs = await listNames(path);
	if (!runs.names) {
		context.entries.push(
			protectedEntry(context, path, `cannot inspect directory: ${runs.problem}`)
		);
		return;
	}
	if (runs.names.length === 0)
		context.entries.push(protectedEntry(context, path, 'unregistered empty commit directory'));
	for (const run of runs.names.sort()) await scanRun(context, commitName, run);
}

async function scanRun(context: CacheScanContext, commit: string, run: string): Promise<void> {
	const path = join(context.store, commit, run);
	const scanned = await scanCacheTree(path);
	const entry: PruneInventoryEntry = {
		path: relative(context.root, path),
		retentionMatch: false,
		...(scanned.bytes !== undefined && { bytes: scanned.bytes }),
		protectionReasons: [...scanned.reasons]
	};
	if (scanned.reasons.length) {
		context.entries.push(entry);
		return;
	}
	const inspected = await readRecord(path);
	if (!inspected.record) {
		entry.protectionReasons.push(inspected.reason);
		context.entries.push(entry);
		return;
	}
	const { record } = inspected;
	entry.record = record.id;
	entry.sourceCommit = record.source.commit;
	entry.startedAt = record.startedAt;
	if (!registeredPath(commit, run, record)) {
		entry.protectionReasons.push(
			'unregistered path does not match the record commit and start time'
		);
		context.entries.push(entry);
		return;
	}
	const unregistered = unregisteredFiles(record, scanned.files);
	if (unregistered.length) {
		entry.protectionReasons.push(
			`unregistered cache files: ${unregistered.slice(0, 8).join(', ')}`
		);
		context.entries.push(entry);
		return;
	}
	context.valid.push({ entry, startedAt: record.startedAt });
}

async function readRecord(path: string): Promise<{ record?: VerificationRecord; reason: string }> {
	const recordPath = join(path, 'record.json');
	const state = await lstatOrError(recordPath);
	if (state === undefined)
		return {
			reason: 'no regular record.json; this may be an incomplete or in-use verification run'
		};
	if (state instanceof Error) return { reason: `cannot inspect record.json: ${message(state)}` };
	if (state.isSymbolicLink() || !state.isFile())
		return { reason: 'record.json is not a regular file' };
	const validation = await readFile(recordPath, 'utf8')
		.then((text) => new VerificationRecordValidator().validate(JSON.parse(text)))
		.catch(() => undefined);
	if (!validation?.value || validation.errors.length)
		return { reason: 'unregistered or invalid verification record' };
	return { record: validation.value, reason: '' };
}

function registeredPath(commit: string, run: string, record: VerificationRecord): boolean {
	return (
		/^[a-f0-9]{40}$/.test(commit) &&
		record.source.commit === commit &&
		run === record.startedAt.replace(/\D/g, '').slice(0, 17)
	);
}

function unregisteredFiles(record: VerificationRecord, files: string[]): string[] {
	const declared = new Set([
		'record.json',
		captureIndex,
		'browser-errors.ndjson',
		...recordFiles(record).map(({ path }) => path)
	]);
	return files.filter((path) => !declared.has(path));
}

async function listNames(path: string): Promise<{ names?: string[]; problem?: string }> {
	try {
		return { names: await readdir(path) };
	} catch (error) {
		return { problem: message(error) };
	}
}

function protectedEntry(
	context: CacheScanContext,
	path: string,
	reason: string
): PruneInventoryEntry {
	return { path: relative(context.root, path), retentionMatch: false, protectionReasons: [reason] };
}

function missing(error: unknown): boolean {
	return errorCode(error) === 'ENOENT';
}

async function lstatOrError(path: string) {
	try {
		return await lstat(path);
	} catch (error) {
		return missing(error) ? undefined : new Error(message(error));
	}
}

function errorCode(error: unknown): string | undefined {
	return typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		typeof error.code === 'string'
		? error.code
		: undefined;
}

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
