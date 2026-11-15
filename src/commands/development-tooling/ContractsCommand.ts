// @harness-uid u_n3xq7owie5
import { InvalidArgumentError, type Command } from 'commander';
import { runContracts } from './contracts-command/runContracts';

/** Registers read-only stored-contract queries; no source indexing or registry writes. */
export class ContractsCommand {
	register(program: Command): void {
		const contracts = program
			.command('contracts')
			.description('Read, list, search and map stored contracts without opening source.')
			.option('--root <path>', 'Project root (paths are relative to this root).', process.cwd());
		for (const [name, description] of [
			['show <target>', 'Read full contracts by unit id, owned source file, or folder.'],
			['list', 'List one line per contract: id, source path and short description.'],
			[
				'search <query>',
				'Search contract metadata only; rank identity before description and fields.'
			],
			['map <target>', 'Map a unit or source path to contracts, dependencies and dependents.']
		]) {
			const command = contracts.command(name).description(description);
			commonOptions(command);
			if (name.startsWith('search'))
				command
					.option('--regex', 'Interpret query as a JavaScript regular expression (no delimiters).')
					.option('-i, --ignore-case', 'Match without case sensitivity.');
			if (name.startsWith('map'))
				command.option('--depth <count>', 'Relationship hops (0-10).', depth, 1);
			command.action(async (...args: unknown[]) => {
				const selected = args.at(-1) as Command;
				const target = typeof args[0] === 'string' ? args[0] : '';
				console.log(await runContracts(selected.name(), target, selected.optsWithGlobals()));
			});
		}
	}
}

function commonOptions(command: Command): void {
	command
		.option('--kind <kind>', 'Exact unit kind (including internal units).')
		.option('--area <name>', 'Source path segment or dotted unit-id prefix.')
		.option('--folder <path>', 'Only contracts owning this exact path or folder subtree.')
		.option('--include-retired', 'Include stored tombstones as well as active contracts.')
		.option(
			'--limit <count>',
			'Maximum matches; map caps roots (search defaults to 20).',
			positiveInteger
		)
		.option('--json', 'Print JSON only; empty results are arrays.');
}

function positiveInteger(text: string): number {
	if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text)))
		throw new InvalidArgumentError('Expected a positive integer.');
	return Number(text);
}

function depth(text: string): number {
	if (!/^\d+$/.test(text) || Number(text) > 10)
		throw new InvalidArgumentError('Expected an integer from 0 to 10.');
	return Number(text);
}
