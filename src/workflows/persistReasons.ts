import { resolve } from 'node:path';
import { GitAdapter } from '../adapters/GitAdapter';
import type { HistoryNote } from '../core/historyTypes';
import { HistoryNoteRepository } from '../repositories/history-note-repository/HistoryNoteRepository';
import { explainedRange } from './runExplain';
import { sourceCommit } from './runHistory';

export interface PersistedReasons {
	commit: string;
	/** The revision the changes are measured from; null for an empty starting point. */
	base: string | null;
	/** Reasons now noted on the commit. */
	attached: number;
	/** Changes in the range that still have no reason; nothing is written for them. */
	missing: string[];
}

/**
 * Keeps the reasons of a committed range in the notes of its last commit, so they explain the
 * change in every clone and worktree. Only reasons that match the committed content are kept:
 * those of the range as a whole, or of every step when each step of its history is explained.
 */
export async function persistReasons(
	options: { root?: string; commit?: string; base?: string } = {}
): Promise<PersistedReasons> {
	const root = resolve(options.root ?? process.cwd());
	const commit = await sourceCommit(root, options.commit);
	const parent = await new GitAdapter(root).attempt([
		'rev-parse',
		'--verify',
		'--quiet',
		`${commit}^`
	]);
	const from = options.base ?? parent ?? 'none';
	const baseCommit = from === 'none' ? null : await sourceCommit(root, from);
	// The question `explain check` asks, so what it accepts is what is kept: a range explained
	// step by step keeps the reasons of every step, each held to its own revision's limits.
	const report = await explainedRange({ root, base: baseCommit ?? 'none', head: commit });
	const lines = report.entries.map(
		(explanation): HistoryNote => ({ schemaVersion: 1, kind: 'reason', commit, explanation })
	);
	if (lines.length > 0) await new HistoryNoteRepository(root).append(commit, lines);
	return { commit, base: baseCommit, attached: lines.length, missing: report.failures };
}

export function renderReasons(result: PersistedReasons): string {
	const from = result.base ? result.base.slice(0, 12) : 'an empty tree';
	const head = `${result.attached} reasons for ${from}..${result.commit.slice(0, 12)} are kept in notes.`;
	return [head, ...result.missing.map((failure) => `  ${failure}`)].join('\n');
}
