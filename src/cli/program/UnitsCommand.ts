import type { Flags } from './UnitsCommand.types';
import type { Command } from 'commander';
import { fail } from '../../core/development-tooling/errors';
import { listUnits, renderUnit, showUnit, unitSchema, unitsGraph } from './inspectUnits';
import { checkUnits, indexUnits, renderCheck, renderIndex, retireUnit } from './manageUnits';
import { inventoryTests } from './testInventory';

export function registerUnitsCommand(program: Command): void {
	const units = program
		.command('units')
		.description('Maintain the unit registry: stable identities, contracts and the source graph.');
	units
		.command('index')
		.option('--write', 'Write changed manifests to specification/units.')
		.option('--json', 'Print structured results.')
		.description('Reconcile unit manifests with the source tree.')
		.action(async (flags: Flags) => {
			const report = await indexUnits({ write: flags.write });
			print(flags, report, renderIndex(report, Boolean(flags.write)));
		});
	units
		.command('check')
		.option('--json', 'Print structured results.')
		.description('Fail when manifests are invalid, inconsistent or stale.')
		.action(async (flags: Flags) => {
			const report = await checkUnits();
			if (flags.json) console.log(JSON.stringify(report, null, 2));
			if (report.errors.length > 0) fail(report.errors.join('\n'));
			if (!flags.json) console.log(renderCheck(report));
		});
	units
		.command('list')
		.option('--kind <kind>', 'Only show units of one kind.')
		.option('--json', 'Print structured results.')
		.description('List active units.')
		.action(async (flags: Flags) => {
			const listed = await listUnits({ kind: flags.kind });
			const text = listed.map((unit) => `${unit.id}  ${unit.responsibility}`).join('\n');
			print(flags, listed, text);
		});
	registerInspection(units);
	units
		.command('tests')
		.option('--json')
		.description(
			'Inventory test declarations and standardized case coverage without running tests.'
		)
		.action(async () => console.log(JSON.stringify(await inventoryTests(), null, 2)));
}

function registerInspection(units: Command): void {
	units
		.command('show <id>')
		.option('--json', 'Print structured results.')
		.description('Show a unit contract with its consumers, tests and dependency contracts.')
		.action(async (id: string, flags: Flags) => {
			const detail = await showUnit(id);
			print(flags, detail, renderUnit(detail));
		});
	units
		.command('graph')
		.option('--json', 'Print structured results.')
		.description('Print the dependency graph of files, units and scenarios.')
		.action(async (flags: Flags) => {
			const graph = await unitsGraph();
			const text = `${graph.nodes.length} nodes, ${graph.edges.length} edges, ${graph.uncertain.length} uncertain.`;
			print(flags, graph, text);
		});
	units
		.command('retire <id>')
		.requiredOption('--reason <text>', 'Why the unit no longer exists.')
		.description('Retire a unit whose source is gone, keeping its identity as a tombstone.')
		.action(async (id: string, flags: Flags) => {
			const retired = await retireUnit(id, flags.reason ?? '');
			console.log(`Retired ${retired.id}.`);
		});
	units
		.command('schema <name>')
		.description(
			'Print the JSON Schema of ComponentManifest, ScenarioManifest or VerificationRecord.'
		)
		.action((name: string) => console.log(JSON.stringify(unitSchema(name), null, 2)));
}

function print(flags: Flags, value: unknown, text: string): void {
	console.log(flags.json ? JSON.stringify(value, null, 2) : text);
}
