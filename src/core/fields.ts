import { toCamelCase, toSnakeCase } from './case';

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
	return rawFields.map(parseField);
}

function parseField(raw: string): Field {
	const [rawName, rawType = 'string'] = raw.split(':');
	const type = normalizeType(rawType);
	const details = fieldTypes[type];

	return {
		name: toCamelCase(rawName),
		column: toSnakeCase(rawName),
		type,
		tsType: details.tsType,
		sqlType: details.sqlType
	};
}

function normalizeType(value: string): FieldType {
	if (value in fieldTypes) {
		return value as FieldType;
	}

	throw new Error(`Unsupported field type "${value}". Use string, text, number, boolean, date, or json.`);
}
