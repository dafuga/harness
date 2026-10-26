import { readFile } from 'node:fs/promises';
import { WorkingTreeAdapter } from '../../adapters/git-source-history/WorkingTreeAdapter';
import type { Command } from 'commander';
import { fail } from '../../core/development-tooling/errors';
import {
	componentManifestSchema,
	contractItemSchema
} from '../../core/development-tooling/unitTypes';
import { UnitRegistryRepository } from '../../repositories/verification-evidence/UnitRegistryRepository';
import type { DeclaredContractInput, Flags } from './UnitsCommand.types';
import { listUnits, renderUnit, showUnit, unitSchema, unitsGraph } from './inspectUnits';
import { checkUnits, indexUnits, renderCheck, renderIndex, retireUnit } from './manageUnits';

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
	registerContract(units);
	registerInspection(units);
}

function registerContract(units: Command): void {
	units
		.command('contract <id>')
		.requiredOption('--input <file>', 'JSON file with the declared responsibility and contract.')
		.option('--json', 'Print structured results.')
		.description('Author the declared responsibility and contract for an existing unit.')
		.action(async (id: string, flags: Flags) => {
			const declaration = await readContractInput(flags.input ?? '');
			const root = process.cwd();
			const repository = new UnitRegistryRepository(root);
			const registry = await repository.read(new WorkingTreeAdapter(root));
			const current = registry.manifests.find((manifest) => manifest.id === id);
			if (!current) fail(`Unit "${id}" was not found in the registry.`);
			if (current.status === 'retired') fail(`Unit "${id}" is retired.`);
			const candidate = {
				...current,
				responsibility: declaration.responsibility,
				responsibilityOrigin: 'declared' as const,
				contract: { origin: 'declared' as const, ...declaration.contract }
			};
			const validated = componentManifestSchema.safeParse(candidate);
			if (!validated.success) fail(`Invalid declared contract: ${validated.error.message}`);
			await repository.write([validated.data]);
			print(flags, { id, manifest: validated.data }, `Declared contract for ${id}.`);
		});
}

async function readContractInput(file: string): Promise<DeclaredContractInput> {
	let text: string;
	try {
		text = await readFile(file, 'utf8');
	} catch (error) {
		fail(`Cannot read contract input "${file}": ${String(error)}`);
	}
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch (error) {
		fail(`Malformed contract input JSON: ${String(error)}`);
	}
	return parseContractInput(value);
}

function parseContractInput(value: unknown): DeclaredContractInput {
	if (!isRecord(value)) fail('Contract input must be a JSON object.');
	rejectExtraKeys(value, ['responsibility', 'contract'], 'input');
	if (typeof value.responsibility !== 'string' || value.responsibility.trim().length === 0) {
		fail('Contract input requires a non-empty responsibility string.');
	}
	if (!isRecord(value.contract)) fail('Contract input requires a contract object.');
	rejectExtraKeys(value.contract, ['inputs', 'outputs', 'errors'], 'contract');
	return {
		responsibility: value.responsibility,
		contract: {
			inputs: parseContractItems(value.contract.inputs, 'inputs'),
			outputs: parseContractItems(value.contract.outputs, 'outputs'),
			errors: parseContractItems(value.contract.errors, 'errors')
		}
	};
}

function parseContractItems(
	value: unknown,
	field: string
): DeclaredContractInput['contract']['inputs'] {
	if (!Array.isArray(value)) fail(`Contract ${field} must be an array.`);
	return value.map((item, index) => {
		const parsed = contractItemSchema.safeParse(item);
		if (!parsed.success) fail(`Invalid contract ${field}[${index}]: ${parsed.error.message}`);
		return parsed.data;
	});
}

function rejectExtraKeys(value: Record<string, unknown>, allowed: string[], label: string): void {
	const key = Object.keys(value).find((candidate) => !allowed.includes(candidate));
	if (key) fail(`Unknown ${label} key "${key}".`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
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
