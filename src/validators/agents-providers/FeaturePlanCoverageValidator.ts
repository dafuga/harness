import { featurePlanGraphUncertainty } from '../../helpers/agents-providers/featurePlanGraphUncertainty';
import type { FeaturePlan } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { ModuleData } from '../../services/git-source-history/ModuleDataService.types';
import type {
	FeaturePlanCoverageValidatorResult,
	FeaturePlanImpactInput,
	FeaturePlanImpactResult,
	Unit,
	Change
} from './FeaturePlanCoverageValidator.types';

export class FeaturePlanCoverageValidator {
	validate(
		input: FeaturePlan | Record<string, unknown>,
		data?: ModuleData
	): FeaturePlanCoverageValidatorResult {
		if (!planShape(input))
			return result(new Set(), [], ['Feature plan changes and pages are required.']);
		const discovery = this.discover(input, data);
		return result(
			new Set(discovery.affectedPages),
			(input as FeaturePlan).pages.map((page) => page.module),
			discovery.errors
		);
	}

	discover(
		input: FeaturePlanImpactInput | Record<string, unknown>,
		data?: ModuleData
	): FeaturePlanImpactResult {
		const errors: string[] = [];
		const affected = new Set<string>();
		if (!impactShape(input))
			return impactResult(affected, ['Feature plan sourceCommit and changes are required.']);
		if (!data || !data.registry || !Array.isArray(data.registry.units) || !data.relationships)
			return impactResult(affected, ['Committed registry and relationship metadata are required.']);
		const plan = input as FeaturePlanImpactInput;
		validateMetadata(
			plan,
			data,
			errors,
			plan.changes.some((change) => change.kind !== 'reuse')
		);
		const units = new Map(data.registry.units.map((unit) => [unit.id, unit]));
		const changes = new Map(plan.changes.map((change) => [change.unit, change]));
		if (units.size !== data.registry.units.length)
			errors.push('Duplicate committed registry units.');
		if (changes.size !== plan.changes.length) errors.push('Duplicate planned module changes.');
		for (const change of plan.changes) {
			if (change.kind === 'reuse') continue;
			collectPages(change.unit, data, units, affected, errors);
			collectAncestors(change.unit, changes, units, affected, errors);
		}
		return impactResult(affected, errors);
	}
}

export type {
	FeaturePlanCoverageValidatorResult,
	FeaturePlanImpactInput,
	FeaturePlanImpactResult
} from './FeaturePlanCoverageValidator.types';

function planShape(input: FeaturePlan | Record<string, unknown>): boolean {
	return (
		impactShape(input) &&
		Array.isArray(input.pages) &&
		input.pages.every((page) => page && typeof page.module === 'string' && page.module.length > 0)
	);
}

function impactShape(input: FeaturePlanImpactInput | Record<string, unknown>): boolean {
	return (
		!!input &&
		typeof input.sourceCommit === 'string' &&
		input.sourceCommit.length > 0 &&
		Array.isArray(input.changes) &&
		input.changes.every(
			(change) =>
				change &&
				typeof change.unit === 'string' &&
				change.unit.length > 0 &&
				['add', 'modify', 'remove', 'reuse'].includes(change.kind)
		)
	);
}

function impactResult(affected: Set<string>, errors: string[]): FeaturePlanImpactResult {
	const issues = [...new Set(errors)].sort();
	return { valid: issues.length === 0, affectedPages: [...affected].sort(), errors: issues };
}

function result(
	affected: Set<string>,
	declared: string[],
	errors: string[]
): FeaturePlanCoverageValidatorResult {
	const affectedPages = [...affected].sort();
	const declaredPages = new Set(declared);
	const missingPages = affectedPages.filter((page) => !declaredPages.has(page));
	const issues = [
		...new Set([...errors, ...missingPages.map((page) => `Missing page design: ${page}`)])
	].sort();
	return { valid: issues.length === 0, affectedPages, missingPages, errors: issues };
}

function validateMetadata(
	plan: FeaturePlanImpactInput,
	data: ModuleData,
	errors: string[],
	hasChanges: boolean
): void {
	if (!data.registry.available) errors.push('Committed registry is unavailable.');
	if (data.commit !== plan.sourceCommit)
		errors.push('Committed metadata does not match plan sourceCommit.');
	if (!hasChanges) return;
	if (!Array.isArray(data.references) || !Array.isArray(data.sourceGraph?.uncertain))
		errors.push('Committed graph reference metadata is missing.');
	else
		errors.push(
			...featurePlanGraphUncertainty(data, [...data.references, ...data.sourceGraph.uncertain])
		);
	const graph = data.registry.graph;
	if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
		errors.push('Committed registry graph is missing.');
		return;
	}
	const nodes = new Set(graph.nodes.map((node) => node.id));
	for (const edge of graph.edges)
		if (!nodes.has(edge.from) || !nodes.has(edge.to))
			errors.push(`Unresolved committed graph edge: ${edge.from} -> ${edge.to}`);
}

function activeUnit(id: string, units: Map<string, Unit>, errors: string[]): Unit | undefined {
	const unit = units.get(id);
	if (!unit || unit.status !== 'active') {
		errors.push(`Missing or inactive committed unit: ${id}`);
		return undefined;
	}
	return unit;
}

function collectPages(
	id: string,
	data: ModuleData,
	units: Map<string, Unit>,
	pages: Set<string>,
	errors: string[]
): void {
	const unit = activeUnit(id, units, errors);
	if (unit?.kind === 'page') pages.add(id);
	const relations = Object.hasOwn(data.relationships, id) ? data.relationships[id] : undefined;
	if (!relations || !Array.isArray(relations.pages)) {
		errors.push(`Missing committed page relationships: ${id}`);
		return;
	}
	for (const page of relations.pages) {
		const target = activeUnit(page, units, errors);
		if (target?.kind === 'page') pages.add(page);
		else errors.push(`Unresolved committed page relationship: ${id} -> ${page}`);
	}
}

function collectAncestors(
	id: string,
	changes: Map<string, Change>,
	units: Map<string, Unit>,
	pages: Set<string>,
	errors: string[]
): void {
	const seen = new Set([id]);
	let parent = changes.get(id)?.parent;
	while (parent) {
		if (seen.has(parent)) {
			errors.push(`Cyclic planned parent reference: ${id} -> ${parent}`);
			return;
		}
		seen.add(parent);
		const unit = activeUnit(parent, units, errors);
		if (unit?.kind === 'page') pages.add(parent);
		const ancestor = changes.get(parent);
		if (!ancestor) {
			errors.push(`Unresolved planned parent reference: ${id} -> ${parent}`);
			return;
		}
		parent = ancestor.parent;
	}
}
