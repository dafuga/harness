// @harness-uid u_r7qgepnoax
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { repairTrackerInstructions } from './trackerInstructionsBlock';
import type { TrackerInstructionsResult } from './runTrackerInstructions.types';

/** Local file repair: it needs neither the Tracker service nor its configuration. */
export function runTrackerInstructions(args: string[]): number {
	try {
		const { values, positionals } = parseArgs({
			args,
			allowPositionals: true,
			options: { check: { type: 'boolean' }, json: { type: 'boolean' } }
		});
		const files = positionals.length ? positionals.map((file) => resolve(file)) : defaultFiles();
		const results = files.map((file) => repairFile(file, Boolean(values.check)));
		console.log(values.json ? JSON.stringify(results, null, 2) : results.map(line).join('\n'));
		return values.check && results.some(({ status }) => status !== 'current') ? 1 : 0;
	} catch (error) {
		console.error(`tracker: ${error instanceof Error ? error.message : 'instructions failed'}`);
		return 1;
	}
}

function defaultFiles(): string[] {
	const home = homedir();
	return [join(home, '.claude', 'CLAUDE.md'), join(home, '.codex', 'AGENTS.md')];
}

function repairFile(file: string, check: boolean): TrackerInstructionsResult {
	const exists = existsSync(file);
	const { text, changed, notes } = repairTrackerInstructions(
		exists ? readFileSync(file, 'utf8') : ''
	);
	if (!changed) return { file, status: 'current', notes };
	if (check) return { file, status: 'would update', notes };
	replaceFile(exists ? realpathSync(file) : file, text, exists);
	return { file, status: exists ? 'updated' : 'created', notes };
}

/** Atomic replace that keeps the file's mode and writes through a symlink to its target. */
function replaceFile(target: string, text: string, exists: boolean): void {
	mkdirSync(dirname(target), { recursive: true });
	const mode = exists ? statSync(target).mode & 0o777 : 0o644;
	const temporary = `${target}.tracker-tmp-${process.pid}`;
	writeFileSync(temporary, text, { mode });
	chmodSync(temporary, mode);
	renameSync(temporary, target);
}

function line({ file, status, notes }: TrackerInstructionsResult): string {
	return `${status.padEnd(12)} ${file}${notes.length ? `  (${notes.join('; ')})` : ''}`;
}
