import type { Field } from '../core/fields';

export function sqliteModelDefinition(table: string, fields: Field[]): string {
	const properties = [
		"\t\t\tid: { type: 'number' },",
		...fields.map(
			(field) =>
				`\t\t\t${field.name}: { type: '${field.type === 'json' || field.type === 'boolean' || field.type === 'number' ? field.type : 'string'}', column: '${field.column}' },`
		),
		"\t\t\tcreatedAt: { type: 'string', default: 'timestamp' },",
		"\t\t\tupdatedAt: { type: 'string', default: 'timestamp' }"
	];
	return `\tstatic readonly definition = {\n\t\ttable: '${table}',\n\t\tfields: {\n${properties.join('\n')}\n\t\t}\n\t} as const;\n\n`;
}
