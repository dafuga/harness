import { toCamelCase, toSnakeCase } from './case';
import { fail } from './errors';
import { validateFieldName } from './validation';

export type FieldType = 'string' | 'text' | 'number' | 'boolean' | 'date' | 'json';

export interface Field {
	name: string;
	column: string;
	type: FieldType;
	tsType: string;
	sqlType: string;
}

const fieldTypes: Record<FieldType, { tsType: string; sqlType: string }> = {
	string: { tsType: 'string', sqlType: 'TEXT' },
	text: { tsType: 'string', sqlType: 'TEXT' },
	number: { tsType: 'number', sqlType: 'INTEGER' },
	boolean: { tsType: 'boolean', sqlType: 'INTEGER' },
	date: { tsType: 'string', sqlType: 'TEXT' },
	json: { tsType: 'Record<string, unknown>', sqlType: 'TEXT' }
};

export function parseFields(rawFields: string[]): Field[] {
	const fields = rawFields.map(parseField);
	const names = new Set<string>();

	for (const field of fields) {
		if (names.has(field.name)) {
			fail(`Duplicate field "${field.name}". Field names must be unique.`);
		}

		names.add(field.name);
	}

	return fields;
}

function parseField(raw: string): Field {
	const parts = raw.split(':');

	if (parts.length > 2) {
		fail(`Invalid field "${raw}". Use name:type.`);
	}

	const [rawName, rawType = 'string'] = parts;
	const name = validateFieldName(rawName);
	const type = normalizeType(rawType);
	const details = fieldTypes[type];

	return {
		name: toCamelCase(name),
		column: toSnakeCase(name),
		type,
		tsType: details.tsType,
		sqlType: details.sqlType
	};
}

function normalizeType(value: string): FieldType {
	const type = value.trim();

	if (type in fieldTypes) {
		return type as FieldType;
	}

	return fail(
		`Unsupported field type "${value}". Use string, text, number, boolean, date, or json.`
	);
}
