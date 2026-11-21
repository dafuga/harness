import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SqliteModel } from '../../src/core/development-tooling/sqliteTypes';
import type { ComponentManifest } from '../../src/core/unitTypes';

export async function modelExampleCases(unit: ComponentManifest, root = process.cwd()) {
	const source = unit.owns.source.find((path) => !path.endsWith('.types.ts'));
	const symbol = unit.owns.symbols[0];
	if (!source || !symbol) return { schema: null, reason: 'no runtime schema' } as const;

	const exports = (await import(pathToFileURL(resolve(root, source)).href)) as Record<
		string,
		unknown
	>;
	const owner = exports[symbol] as { definition?: SqliteModel } | undefined;
	const schema = owner?.definition;
	if (!schema) return { schema: null, reason: 'no runtime schema' } as const;

	const cases = unit.contract.inputs.flatMap((item) =>
		(item.examples ?? []).map((example) => {
			const fieldName = item.name.slice(item.name.indexOf('.') + 1);
			const field = schema.fields[fieldName];
			const failures: string[] = [];
			if (!field) {
				failures.push(`runtime field ${fieldName} is missing`);
			} else {
				if (field.type !== item.type)
					failures.push(`runtime field type does not match ${item.type}`);
				if (example === null) {
					if (field.nullable !== true) failures.push('null requires a nullable field');
				} else if (!matchesExampleType(example, field.type)) {
					failures.push(`example type does not match ${field.type}`);
				}
			}
			return {
				name: item.name,
				fieldName,
				example,
				valid: failures.length === 0,
				...(failures.length ? { reason: failures.join('; ') } : {})
			};
		})
	);
	return { schema, cases };
}

function matchesExampleType(
	example: unknown,
	type: SqliteModel['fields'][string]['type']
): boolean {
	switch (type) {
		case 'string':
			return typeof example === 'string';
		case 'number':
			return typeof example === 'number';
		case 'boolean':
			return typeof example === 'boolean';
		case 'json':
			return true;
		case 'blob':
			return (
				Array.isArray(example) &&
				example.every(
					(byte) => typeof byte === 'number' && Number.isInteger(byte) && byte >= 0 && byte <= 255
				)
			);
		default:
			return false;
	}
}
