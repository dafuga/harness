import type { Command } from 'commander';
import { fail } from '../../core/development-tooling/errors';
import {
	explainAdd,
	explainedRange,
	listed,
	type ExplainInput
} from '../../workflows/development-tooling/runExplain';

type Flags = ExplainInput & { json?: boolean };

const collect = (value: string, previous: string[] = []): string[] => [...previous, value];

function ranged(command: Command): Command {
	return command
		.option('--base <revision>', 'Revision to compare from; "none" for an empty start.', 'HEAD')
		.option('--head <revision>', 'Revision to compare to; defaults to the working tree.');
}

export function registerExplainCommand(program: Command): void {
	const explain = program
		.command('explain')
		.description('Record why each changed function or unit changed, and what was tried.');
	ranged(explain.command('add'))
		.option('--unit <id>', 'Unit whose change is being explained.')
		.option('--symbol <name>', 'Changed function or symbol; repeat for several.', collect)
		.option('--all', 'Explain every unexplained change in the range with this one reason.')
		.option(
			'--replace',
			'Also replace a reason that exceeds the writing limits; the earlier one stays stored.'
		)
		.option('--behavior <text>', 'What changed in behaviour.')
		.option('--simplification <text>', 'What was tried to make it simpler.')
		.option('--simplification-outcome <outcome>', 'improved, not-improved or not-applicable.')
		.option('--performance <text>', 'What was tried for performance, or why nothing applies.')
		.option('--performance-outcome <outcome>', 'improved, not-improved or not-applicable.')
		.description('Record a reason bound to the exact content of the change.')
		.action(async (flags: Flags) => {
			const entries = await explainAdd(flags);
			console.log(`Recorded ${entries.length} reason${entries.length === 1 ? '' : 's'}.`);
		});
	ranged(explain.command('list'))
		.option('--json', 'Print structured results.')
		.description('List the changes that need a reason and whether each has one.')
		.action(async (flags: Flags) => {
			const report = await explainedRange(flags);
			const rows = listed(report);
			const text = rows
				.map((row) => `${row.state.padEnd(9)} ${row.unit} ${row.symbol} (${row.change})`)
				.join('\n');
			console.log(flags.json ? JSON.stringify({ required: rows }, null, 2) : text);
		});
	ranged(explain.command('check'))
		.description('Fail when a changed function or unit has no current reason.')
		.action(async (flags: Flags) => {
			const report = await explainedRange(flags);
			if (report.failures.length > 0) fail(report.failures.join('\n'));
			console.log(`Every change is explained: ${report.required.length} reasons.`);
		});
}
