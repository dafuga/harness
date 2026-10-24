import { expect, test } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { componentManifestSchema } from '../src/core/unitTypes';

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
