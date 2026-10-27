import type { Flags } from './HistoryCommand.types';
import type { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import {
	ScreenshotBaselineService,
	type ScreenshotBaselineRequest,
	type ScreenshotReviewInput
} from '../../services/verification-evidence/ScreenshotBaselineService';
import { buildHistory, renderBuild, type BuildOptions } from './buildHistory';
import { importReports, renderImport, type ImportOptions } from './importReports';
import { persistReasons, renderReasons } from './persistReasons';
import { renderSync, syncHistory, type SyncAction } from './syncHistory';
import {
	historyAttach,
	historyStatus,
	renderStatus
} from '../../workflows/git-source-history/runHistory';

function print(flags: Flags, value: unknown, text: string): void {
	console.log(flags.json ? JSON.stringify(value, null, 2) : text);
}

export function registerHistoryCommand(program: Command): Command {
	const history = program
		.command('history')
		.description('Keep verification records, evidence and reasons in Git, and read them back.');
	registerRecords(history);
	registerSync(history);
	registerOutputs(history);
	registerScreenshots(history);
	return history;
}

/** Screenshot reviews are explicit; reading never replaces an existing file. */
function registerScreenshots(history: Command): void {
	const screenshot = history.command('screenshot').description('Review and read captured pixels.');
	screenshot
		.command('review')
		.requiredOption('--commit <hash>', 'Full tested source commit.')
		.requiredOption('--record <id>', 'Attached verification record id.')
		.requiredOption('--unit <id>', 'Visual unit id.')
		.requiredOption('--case <id>', 'Declared visual case id.')
		.requiredOption('--scenario <id>', 'Scenario that produced the capture.')
		.requiredOption('--evidence <id>', 'Declared screenshot evidence id.')
		.requiredOption('--viewport <id>', 'Declared viewport id.')
		.requiredOption('--reviewer <name>', 'Person who inspected the original image.')
		.requiredOption('--reason <text>', 'Why this image is the expected baseline.')
		.option('--json', 'Print structured results.')
		.description('Retain an explicit review of an intact screenshot in Git evidence.')
		.action(async ({ json, ...input }: ScreenshotReviewInput & { json?: boolean }) => {
			const review = await new ScreenshotBaselineService(process.cwd()).review(input);
			print({ json }, review, `Screenshot review ${review.id} retained.`);
		});
	screenshot
		.command('read')
		.requiredOption('--id <hash>', 'Screenshot review id.')
		.requiredOption('--unit <id>', 'Visual unit id.')
		.requiredOption('--case <id>', 'Declared visual case id.')
		.requiredOption('--viewport <id>', 'Declared viewport id.')
		.requiredOption('--file <path>', 'Authored screenshot file for this case.')
		.requiredOption('--out <path>', 'New file to receive the original PNG bytes.')
		.option('--json', 'Print structured results.')
		.description('Read reviewed original pixels without overwriting an existing file.')
		.action(
			async ({
				json,
				out,
				...input
			}: ScreenshotBaselineRequest & { json?: boolean; out: string }) => {
				const baseline = await new ScreenshotBaselineService(process.cwd()).load(input);
				await writeFile(out, baseline.bytes, { flag: 'wx' });
				print(
					{ json },
					{ id: baseline.review.id, sha256: baseline.review.sha256, out },
					`Wrote ${out}.`
				);
			}
		);
}

/** Commands that write or read what is attached to a commit. */
function registerRecords(history: Command): void {
	history
		.command('attach')
		.option('--commit <revision>', 'Source commit the record belongs to.', 'HEAD')
		.option('--record <id>', 'Record id or file; the latest record of the commit by default.')
		.option('--json', 'Print structured results.')
		.description('Store a verification record and its evidence in Git without changing the commit.')
		.action(async (flags: Flags) => {
			const attached = await historyAttach(flags);
			const state = attached.created ? 'attached' : 'was already attached';
			const where = `${attached.evidence.commit.slice(0, 12)}:${attached.evidence.path}`;
			const record = `Record ${attached.record.slice(0, 12)} (${attached.status})`;
			print(flags, attached, `${record} ${state} at ${where}.`);
		});
	history
		.command('status')
		.option('--commit <revision>', 'Source commit to report on.', 'HEAD')
		.option('--json', 'Print structured results.')
		.description('Show what Git history proves about a commit and every problem found.')
		.action(async (flags: Flags) => {
			const status = await historyStatus(flags);
			print(flags, status, renderStatus(status));
		});
	history
		.command('reasons')
		.option('--commit <revision>', 'Last commit of the range.', 'HEAD')
		.option('--base <revision>', 'Where the range starts; the first parent by default.')
		.option('--json', 'Print structured results.')
		.description('Keep the reasons of a committed range in the notes of its last commit.')
		.action(async (flags: Flags & { base?: string }) => {
			const result = await persistReasons(flags);
			print(flags, result, renderReasons(result));
			if (result.missing.length > 0) process.exitCode = 1;
		});
}

/** Commands that produce the history index or bring older reports into history. */
function registerOutputs(history: Command): void {
	history
		.command('build')
		.requiredOption('--out <directory>', 'Where to write the index, revision details and media.')
		.option('--limit <count>', 'Newest commits to include.', '2000')
		.option('--strict', 'Exit with an error when anything could not be used.')
		.option('--json', 'Print structured results, including the index.')
		.description('Build the portable history index and its media from Git alone.')
		.action(async (flags: BuildOptions & { json?: boolean; strict?: boolean }) => {
			const built = await buildHistory(flags);
			print(flags, built, renderBuild(built));
			if (!flags.strict || built.problems.length === 0) return;
			for (const problem of built.problems) console.error(problem);
			process.exitCode = 1;
		});
	history
		.command('import-reports')
		.requiredOption('--from <directory>', 'Legacy report store to read; it is never written.')
		.option('--project <name>', 'Project id or name, when runs were made in another directory.')
		.option('--json', 'Print structured results.')
		.description("Import this repository's legacy reports with their original dates and outcomes.")
		.action(async (flags: ImportOptions & { json?: boolean }) => {
			const result = await importReports(flags);
			print(flags, result, renderImport(result));
		});
}

const syncHelp: Record<SyncAction, string> = {
	fetch: "Bring the remote's evidence, notes, media and archived source here and merge them.",
	push: 'Send local evidence, media, notes and archived source; never forced.',
	sync: 'Fetch and merge, then push, so both sides hold every record.'
};

function registerSync(history: Command): void {
	for (const action of ['fetch', 'push', 'sync'] as const) {
		history
			.command(`${action} [remote]`)
			.option('--json', 'Print structured results.')
			.description(syncHelp[action])
			.action(async (remote: string | undefined, flags: Flags) => {
				const result = await syncHistory(action, remote);
				print(flags, result, renderSync(action, result));
				for (const problem of result.problems ?? []) console.error(problem);
				if (result.problems?.length) process.exitCode = 1;
			});
	}
}
