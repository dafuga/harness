// @harness-uid u_hstregiabc
import { InvalidArgumentError, type Command } from 'commander';
import { readContractDiff, readContractLog } from './readContractHistory';
import {
	renderContractDiff,
	renderContractLog,
	renderContractHistoryJson
} from './renderContractHistory';
import type { ContractHistoryOptions } from './contractHistory.types';

/** Add snapshot/history queries beside existing stored-contract lookup operations. */
export function registerContractHistory(contracts: Command): void {
	const diff = contracts
		.command('diff [revision] [head]')
		.description(
			'Compare stored contract fields: HEAD -> worktree, a commit, <base>..<head>, or two revisions.'
		);
	historyOptions(diff)
		.option('--unit <id>', 'Match either snapshot by unit id or stable uid.')
		.option(
			'--since <revision>',
			'Compare revision -> working tree (includes untracked contracts).'
		)
		.option('--staged', 'Compare HEAD -> Git index; excludes unstaged and untracked changes.');
	diff.action(
		async (
			revision: string | undefined,
			head: string | undefined,
			_options: unknown,
			command: Command
		) => {
			const options = command.optsWithGlobals<ContractHistoryOptions>();
			const result = await readContractDiff(
				[revision, head].filter((item): item is string => item !== undefined),
				options
			);
			console.log(
				options.json
					? renderContractHistoryJson(result, options.summary)
					: renderContractDiff(result, options.summary)
			);
		}
	);
	for (const verb of ['log [unit]', 'last <unit>']) {
		const command = contracts
			.command(verb)
			.description(
				verb.startsWith('last')
					? 'Latest committed material contract change, with fields and commit identity.'
					: 'Reachable commits with per-contract change summaries; follows stable unit identity.'
			);
		historyOptions(command).option(
			'--since <revision>',
			'Only committed changes after this revision, through HEAD.'
		);
		command.action(async (unit: string | undefined, _options: unknown, selected: Command) => {
			const options = selected.optsWithGlobals<ContractHistoryOptions>();
			const result = await readContractLog(unit ?? '', options, selected.name() === 'last');
			console.log(
				options.json
					? renderContractHistoryJson(result, options.summary)
					: renderContractLog(result, selected.name() === 'log' || options.summary)
			);
		});
	}
}

function historyOptions(command: Command): Command {
	return command
		.option('--kind <kind>', 'Exact recorded unit kind (both snapshots, including retired).')
		.option('--area <name>', 'Source path segment or dotted unit-id prefix in either snapshot.')
		.option('--folder <path>', 'Owned source or contract path subtree in either snapshot.')
		.option(
			'--field <fields>',
			'Comma-separated type, description, examples, errors, dependencies.'
		)
		.option('--summary', 'Per-contract field-kind counts; omit field values in text and JSON.')
		.option(
			'--limit <count>',
			'Maximum displayed contracts (diff) or matching commits (log; default 20).',
			historyLimit
		)
		.option('--json', 'Structured JSON; counts cover all filtered changes before diff --limit.');
}

function historyLimit(text: string): number {
	if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text)))
		throw new InvalidArgumentError('Expected a positive integer.');
	return Number(text);
}
