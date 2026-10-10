import type { Command } from 'commander';
import {
	budgetBench,
	budgetHistory,
	budgetMeasure,
	budgetStatus,
	type BenchInput,
	type SignedInput
} from '../workflows/runBudget';
import { budgetApprove, budgetEstablish } from '../workflows/signBudget';

type Flags = Partial<SignedInput> & Partial<BenchInput> & { json?: boolean };

const print = (flags: Flags, value: unknown, text: string): void =>
	console.log(flags.json ? JSON.stringify(value, null, 2) : text);

function signed(command: Command): Command {
	return command
		.requiredOption('--record <id>', 'Clean verification record that measured the limits.')
		.requiredOption('--reviewer <name>', 'Person who reviewed the change; not its author.')
		.requiredOption('--reason <text>', 'Why the limits are acceptable.');
}

export function registerBudgetCommand(program: Command): void {
	const budget = program
		.command('budget')
		.description(
			'Frozen size, complexity and performance limits, changed only by recorded review.'
		);
	budget
		.command('measure [unit]')
		.option('--json', 'Print structured results.')
		.description('Show current size and complexity in the working tree; observational only.')
		.action(async (unit: string | undefined, flags: Flags) => {
			const rows = await budgetMeasure(unit);
			print(flags, rows, rows.map((row) => `${row.unit} ${row.metric} ${row.value}`).join('\n'));
		});
	budget
		.command('status')
		.option('--json', 'Print structured results.')
		.description('Show which units have a baseline, inherit one, or have none.')
		.action(async (flags: Flags) => {
			const status = await budgetStatus();
			const text = `${status.baselined} units have a baseline; ${status.unbaselined.length} have none.`;
			print(flags, status, text);
		});
	budget
		.command('history [unit]')
		.option('--json', 'Print structured results.')
		.description('Show every baseline and approval recorded in the ledger.')
		.action(async (unit: string | undefined, flags: Flags) => {
			const events = await budgetHistory(unit);
			const text = events
				.map(
					(event) => `${event.at} ${event.type} ${event.unit} by ${event.reviewer}: ${event.reason}`
				)
				.join('\n');
			print(flags, events, text);
		});
	registerSigned(budget);
}

/** Commands that change limits: each needs a clean record, a reviewer and a reason. */
function registerSigned(budget: Command): void {
	signed(budget.command('establish [units...]'))
		.option('--all', 'Every unit the record measured that has no baseline yet.')
		.description('Freeze the limits of units without a baseline, from a clean verified record.')
		.action(async (units: string[], flags: Flags) => {
			const events = await budgetEstablish({ ...flags, units, record: flags.record ?? '' });
			console.log(`Established ${events.length} baseline${events.length === 1 ? '' : 's'}.`);
		});
	signed(budget.command('approve <units...>'))
		.description('Record a reviewed change of limits, with the values before and after.')
		.action(async (units: string[], flags: Flags) => {
			const events = await budgetApprove({ ...flags, units, record: flags.record ?? '' });
			console.log(`Recorded ${events.length} approval${events.length === 1 ? '' : 's'}.`);
		});
	budget
		.command('bench <unit>')
		.requiredOption('--workload <file>', 'Workload file: the request to send and how often.')
		.option('--target <kind>', 'Execution target to measure; the default target when omitted.')
		.option('--evidence <id>', 'Evidence requirement this benchmark satisfies.', 'benchmark')
		.option('--state <id>', 'Scenario state the benchmark belongs to.', 'default')
		.description('Measure a unit end to end through its declared execution target.')
		.action(async (unit: string, flags: Flags) => {
			const result = await budgetBench({ ...flags, unit, workload: flags.workload ?? '' });
			console.log(JSON.stringify(result, null, 2));
		});
}
