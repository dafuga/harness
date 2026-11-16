// @harness-uid u_hpruneview
import { join, resolve } from 'node:path';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { verificationsDirectory } from '../../../core/verification-evidence/verifyTypes';
import { scanVerificationCache } from './scanVerificationCache';
import type { PruneInventory, PruneInventoryEntry } from './previewHistoryPrune.types';

const busyDraftReason =
	'local record may still be needed for attachment or concurrent use; no durable deletion proof or use lock is checked';

/** Returns age/keep-last matches as protected report rows; never deletes cache data. */
export async function previewHistoryPrune(
	root: string,
	keepLast: number,
	olderThanDays: number,
	now = new Date()
): Promise<PruneInventory> {
	validateRetention(keepLast, olderThanDays);
	const rootPath = resolve(root);
	const store = join(rootPath, verificationsDirectory);
	const cutoff = new Date(now.getTime() - olderThanDays * 86400000).toISOString();
	const headCommit = await new GitAdapter(rootPath).attempt([
		'rev-parse',
		'--verify',
		'--quiet',
		'HEAD^{commit}'
	]);
	const scanned = await scanVerificationCache(rootPath, store);
	applyRetention(scanned, keepLast, cutoff, headCommit);
	return {
		mode: 'report-only',
		applySupported: false,
		keepLast,
		olderThanDays,
		cutoff,
		...(headCommit && { headCommit }),
		entries: scanned.entries.sort((left, right) => left.path.localeCompare(right.path)),
		problems: scanned.problems
	};
}

export function renderPrune(result: PruneInventory): string {
	const matches = result.entries.filter((entry) => entry.retentionMatch);
	return [
		`Report-only inventory: ${matches.length} records match keep-last ${result.keepLast} and older-than ${result.olderThanDays} days.`,
		'No files were changed. Deletion is not supported; no --apply mode exists.',
		...matches.map((entry) => renderEntry(entry)),
		...result.problems.map((problem) => `  Problem: ${problem}`)
	].join('\n');
}

function renderEntry(entry: PruneInventoryEntry): string {
	return `  ${entry.path} (${entry.bytes ?? 'unknown'} bytes): protected — ${entry.protectionReasons.join('; ')}`;
}

function validateRetention(keepLast: number, olderThanDays: number): void {
	if (!Number.isSafeInteger(keepLast) || keepLast < 0 || keepLast > 100_000)
		throw new ExpectedCliError('--keep-last must be a whole number between 0 and 100000.');
	if (!Number.isSafeInteger(olderThanDays) || olderThanDays < 1 || olderThanDays > 36500)
		throw new ExpectedCliError('--older-than must be between 1 and 36500 whole days.');
}

function applyRetention(
	scanned: Awaited<ReturnType<typeof scanVerificationCache>>,
	keepLast: number,
	cutoff: string,
	headCommit: string | undefined
): void {
	scanned.valid.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
	const kept = new Set(scanned.valid.slice(0, keepLast).map(({ entry }) => entry.path));
	for (const { entry, startedAt } of scanned.valid) {
		entry.retentionMatch = Date.parse(startedAt) < Date.parse(cutoff) && !kept.has(entry.path);
		protectCurrentHead(entry, headCommit);
		if (entry.retentionMatch) entry.protectionReasons.push(busyDraftReason);
		scanned.entries.push(entry);
	}
	if (!headCommit)
		scanned.problems.push(
			'Could not resolve HEAD; current-commit protection could not be checked.'
		);
}

function protectCurrentHead(entry: PruneInventoryEntry, headCommit: string | undefined): void {
	if (entry.sourceCommit === headCommit)
		entry.protectionReasons.push('record belongs to the current HEAD commit');
	else if (!headCommit)
		entry.protectionReasons.push(
			'HEAD is unavailable; current-commit protection cannot be confirmed'
		);
}
