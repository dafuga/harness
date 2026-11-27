import { expect, test } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { componentManifestSchema, type ComponentManifest } from '../src/core/unitTypes';

const reviewedComponents = new Set<string>(
	JSON.parse(
		readFileSync(
			resolve(import.meta.dirname, '../specification/loops/sol6-component-evidence/contracts.json'),
			'utf8'
		)
	).units
);

const described = (value: string | undefined) =>
	Boolean(value?.trim()) && !/^(No description|TODO|TBD)\b/i.test(value ?? '');

test('every active function and component explains its contract without requiring source code', () => {
	const directory = resolve(import.meta.dirname, '../specification/units');
	const gaps: string[] = [];
	let reviewed = 0;
	for (const file of readdirSync(directory).filter((name) => name.endsWith('.json'))) {
		const unit = componentManifestSchema.parse(
			JSON.parse(readFileSync(resolve(directory, file), 'utf8'))
		);
		if (unit.status !== 'active' || !['function', 'component'].includes(unit.kind)) continue;
		reviewed++;
		if (unit.responsibilityOrigin !== 'declared' || /^Owns the\b/.test(unit.responsibility))
			gaps.push(`${unit.id}: describe its responsibility`);
		if (unit.contract.origin !== 'declared') gaps.push(`${unit.id}: review the derived contract`);
		appendReviewedPropGaps(unit, gaps);
		for (const group of ['inputs', 'outputs', 'errors'] as const)
			for (const field of unit.contract[group])
				if (!described(field.description)) gaps.push(`${unit.id}: describe ${group}.${field.name}`);
	}
	expect(reviewed).toBeGreaterThan(0);
	expect(gaps, `${gaps.length} contract gaps; first 20:\n${gaps.slice(0, 20).join('\n')}`).toEqual(
		[]
	);
});

test('SQLite catalog functions and persisted models publish declared human-readable contracts', () => {
	const directory = resolve(import.meta.dirname, '../specification/units');
	const ids = [
		'function.catalog-models',
		'function.sqlite-binding',
		'function.sqlite-input',
		'function.sqlite-row',
		'function.sqlite-table-sql',
		'function.sqlite-types',
		'model.provider-switch'
	];
	const gaps: string[] = [];
	for (const id of ids) {
		const unit = componentManifestSchema.parse(
			JSON.parse(readFileSync(resolve(directory, `${id}.json`), 'utf8'))
		);
		if (unit.responsibilityOrigin !== 'declared' || /^Owns the\b/.test(unit.responsibility))
			gaps.push(`${id}: responsibility is not declared`);
		if (id === 'model.provider-switch') {
			expect(unit.responsibility).toMatch(/\bwraps\b/i);
			expect(unit.responsibility).toMatch(/\bswitches\b/);
		}
		if (unit.contract.origin !== 'declared') gaps.push(`${id}: contract is not declared`);
		for (const group of ['inputs', 'outputs', 'errors'] as const)
			for (const field of unit.contract[group])
				if (!described(field.description))
					gaps.push(`${id}: ${group}.${field.name} is undescribed`);
	}
	expect(
		gaps,
		`SQLite catalog units require declared readable contracts: ${gaps.slice(0, 12).join('; ')}`
	).toEqual([]);
});

test('reviewed architecture units describe method inputs, defaults, outputs and failures', () => {
	const ids = [
		'validator.unit-registry',
		'workflow.manage-units',
		'service.source-graph',
		'service.source-index',
		'service.unit-index',
		'workflow.generate-code',
		'workflow.create-project',
		'workflow.projects-sessions-generate-code-generate-elements',
		'function.files',
		'service.agents-providers-module-task-analytics-service-task-metrics',
		'model.catalog-branch',
		'model.catalog-revision',
		'model.catalog-scenario',
		'model.analytics-event',
		'model.catalog-record',
		'model.catalog-entity',
		'model.catalog-dependency',
		'model.provider-switch',
		'model.catalog-revision-entity',
		'model.catalog-metadata',
		'model.adapters-types',
		'model.adapters-sqlite',
		'desktop.component.game-create',
		'desktop.component.game-level-brief',
		'desktop.component.game-view-fields',
		'reports.component.entity-cases',
		'reports.component.explorer-ui-explorer-kit-card',
		'reports.component.explorer-usage',
		'reports.component.harness-entity-details',
		'reports.component.harness-entity-source',
		'reports.component.harness-explorer-controls',
		'reports.component.harness-harness-console',
		'reports.component.harness-harness-verdict'
	];
	for (const id of ids) {
		const unit = componentManifestSchema.parse(
			JSON.parse(
				readFileSync(resolve(import.meta.dirname, `../specification/units/${id}.json`), 'utf8')
			)
		);
		expect(unit.responsibilityOrigin, id).toBe('declared');
		expect(unit.responsibility, id).not.toMatch(/^Owns the\b/);
		expect(unit.contract.origin, id).toBe('declared');
		const contracts = [
			unit.contract,
			...(unit.contract.operations ?? []),
			...(unit.contract.initialization ?? [])
		];
		for (const contract of contracts) assertContractFields(id, contract);
	}
});

function assertContractFields(
	id: string,
	contract: Pick<ComponentManifest['contract'], 'inputs' | 'outputs' | 'errors'>
): void {
	for (const group of ['inputs', 'outputs', 'errors'] as const)
		for (const field of contract[group]) {
			expect(described(field.description), `${id}: ${group}.${field.name}`).toBe(true);
			if (group === 'inputs') expect(typeof field.required, `${id}: ${field.name}`).toBe('boolean');
			if (group === 'inputs' && id.includes('.component.') && field.required === false)
				expect(
					recordsDefault(field) || /defaults?\b/i.test(field.description ?? ''),
					`${id}: ${field.name} explains its omitted default`
				).toBe(true);
		}
}

function appendReviewedPropGaps(unit: ComponentManifest, gaps: string[]): void {
	if (!reviewedComponents.has(unit.id)) return;
	for (const field of unit.contract.inputs) {
		if (typeof field.required !== 'boolean')
			gaps.push(`${unit.id}: required flag for ${field.name}`);
		const documentedDefault = /Defaults to /.test(field.description ?? '');
		if (field.required === false && !recordsDefault(field) && !documentedDefault)
			gaps.push(`${unit.id}: default for ${field.name}`);
	}
}

function recordsDefault(field: ComponentManifest['contract']['inputs'][number]): boolean {
	return Object.hasOwn(field, 'default') || field.defaultKind !== undefined;
}
