

export type FieldType = 'string' | 'text' | 'number' | 'boolean' | 'date' | 'json';

export interface Field {
	name: string;
	column: string;
	type: FieldType;
	tsType: string;
	sqlType: string;
}

export { parseFields } from '../workflows/generate-code/fields';
