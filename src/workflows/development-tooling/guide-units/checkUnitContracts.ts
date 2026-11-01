import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type {
	ContractCheckReport,
	ContractFinding,
	GuidanceContext,
	GuidanceOptions
} from './guideUnits.types';
import { fail } from '../../../core/development-tooling/errors';
import { deriveContract } from '../load-units/unit-index-service/deriveContract';
import { contractFindings, contractScopes, documentsState } from './contractFindings';
import { contractStates, unitStateName } from './contractStates';
import {
	guidanceContext,
	guidanceUnit,
	namedUnitStates,
	sourceUnitStates
} from './guidanceContext';
import { stateTests } from './stateTests';

export async function checkUnitContracts(
	id: string | undefined,
	options: GuidanceOptions & { all?: boolean } = {}
): Promise<ContractCheckReport> {
	if (Boolean(id) === Boolean(options.all)) fail('Select one unit identity or --all.');
	const context = await guidanceContext(options, false);
	const units = id
		? [guidanceUnit(context, id)]
		: context.loaded.stored.filter((unit) => unit.status === 'active');
	const findings: ContractFinding[] = [];
	const counts: ContractCheckReport['counts'] = [];
	for (const unit of units) {
		const own = unit.owns.source.flatMap((path) => context.loaded.index.files.get(path) ?? []);
		const direct = contractFindings(unit, deriveContract(own, unit.runtime.entry));
		const states = await stateFindings(context, unit);
		const current = [...direct, ...states];
		findings.push(...current);
		counts.push({ entity: unit.id, findings: current.length });
	}
	return {
		entities: units.map((unit) => unit.id),
		findings,
		counts,
		summary: { entities: units.length, findings: findings.length }
	};
}

async function stateFindings(
	context: GuidanceContext,
	unit: ComponentManifest
): Promise<ContractFinding[]> {
	if (!['component', 'page', 'layout'].includes(unit.kind)) return [];
	const findings: ContractFinding[] = [];
	const add = (kind: ContractFinding['kind'], detail: string, where: string) =>
		findings.push({ entity: unit.id, kind, detail, where });
	const registries = context.registries.filter((row) => row.entity === unit.id);
	const sourceStates = await sourceUnitStates(context, unit);
	const registryStates = namedUnitStates(context, unit);
	findings.push(...undocumentedStates(unit, [...sourceStates, ...registryStates]));
	const implied = contractStates(unit.contract);
	findings.push(
		...(await untestedStates(
			context,
			unit,
			registryStates.map((state) => state.name)
		))
	);
	for (const registry of registries) {
		const declared = new Set([
			'default',
			...registry.states.map((name) => unitStateName(unit.id, name))
		]);
		const missing = implied.filter((state) => !declared.has(state.name)).map((state) => state.name);
		if (missing.length)
			add(
				'required-states-incomplete',
				`State list omits contract-implied states: ${missing.join(', ')}. Heuristic boundaries need review.`,
				registry.where
			);
	}
	return findings;
}

function undocumentedStates(
	unit: ComponentManifest,
	states: Array<{ name: string; reasons: string[] }>
): ContractFinding[] {
	const items = contractScopes(unit.contract).flatMap((scope) => [
		...scope.contract.inputs,
		...scope.contract.outputs,
		...scope.contract.errors
	]);
	return [...new Map(states.map((state) => [state.name, state])).values()]
		.filter((state) => state.name !== 'default' && !documentsState(items, state.name))
		.map((state) => ({
			entity: unit.id,
			kind: 'undocumented-state',
			detail: `State ${state.name} is used in source/registries but absent from the contract.`,
			where: state.reasons[0]
		}));
}

async function untestedStates(
	context: GuidanceContext,
	unit: ComponentManifest,
	registered: string[]
) {
	const findings: ContractFinding[] = [];
	for (const state of contractStates(unit.contract)) {
		const catalog = registered.includes(state.name);
		const tests = catalog ? await stateTests(context, unit, state.name) : [];
		if (!catalog || !tests.length)
			findings.push({
				entity: unit.id,
				kind: 'untested-state',
				detail: `Contract state ${state.name} (${state.origin}): catalog variant ${catalog ? 'present' : 'missing'}, test ${tests.length ? 'present' : 'missing'}.`,
				where: `specification/units/${unit.id}.json#contract`
			});
	}
	return findings;
}

export function renderContractCheck(report: ContractCheckReport): string {
	return [
		...report.counts.map((count) => `${count.entity}: ${count.findings} findings`),
		...report.findings.map(
			(finding) => `${finding.entity} [${finding.kind}] ${finding.detail}\n  ${finding.where}`
		),
		`${report.summary.findings} findings across ${report.summary.entities} entities. Heuristic review; not a completeness proof.`
	].join('\n');
}
