import { toKebabCase, toPascalCase, toSnakeCase } from '../core/case';
import type { Field } from '../core/fields';
import type { PlannedFile } from '../core/files';

export type AdapterName = 'd1' | 'sqlite' | 'postgres';

export interface ModelInput {
	name: string;
	fields: Field[];
	adapter: AdapterName;
}

export function modelFiles(input: ModelInput): PlannedFile[] {
	const className = toPascalCase(input.name);
	const tableName = `${toSnakeCase(input.name)}s`;
	const kebabName = toKebabCase(input.name);

	return [
		{
			path: `src/models/${className}.types.ts`,
			contents: typeFile(className, input.fields)
		},
		{
			path: `src/models/${className}.ts`,
			contents: modelFile(className, tableName)
		},
		{
			path: `src/models/adapters/${input.adapter}.ts`,
			contents: adapterFile(input.adapter)
		},
		{
			path: `db/migrations/create_${tableName}.sql`,
			contents: migrationFile(tableName, input.fields)
		},
		{
			path: `test/models/${kebabName}.test.ts`,
			contents: modelTestFile(className)
		}
	];
}

function typeFile(className: string, fields: Field[]): string {
	const fieldLines = fields.map((field) => `\t${field.name}: ${field.tsType};`).join('\n');

	return `export interface ${className}Attributes {\n\tid: number;\n${fieldLines}\n\tcreatedAt: string;\n\tupdatedAt: string;\n}\n\nexport type ${className}CreateInput = Omit<${className}Attributes, 'id' | 'createdAt' | 'updatedAt'>;\nexport type ${className}UpdateInput = Partial<${className}CreateInput>;\n`;
}

function modelFile(className: string, tableName: string): string {
	return `import type { PersistenceAdapter } from './adapters/types';\nimport type { ${className}Attributes, ${className}CreateInput, ${className}UpdateInput } from './${className}.types';\n\nconst tableName = '${tableName}';\n\nexport class ${className} {\n\tstatic find(adapter: PersistenceAdapter, id: number): Promise<${className}Attributes | null> {\n\t\treturn adapter.find(tableName, id);\n\t}\n\n\tstatic findBy(adapter: PersistenceAdapter, fields: Partial<${className}Attributes>): Promise<${className}Attributes[]> {\n\t\treturn adapter.findBy(tableName, fields);\n\t}\n\n\tstatic create(adapter: PersistenceAdapter, input: ${className}CreateInput): Promise<${className}Attributes> {\n\t\treturn adapter.create(tableName, input);\n\t}\n\n\tstatic update(adapter: PersistenceAdapter, id: number, input: ${className}UpdateInput): Promise<${className}Attributes | null> {\n\t\treturn adapter.update(tableName, id, input);\n\t}\n\n\tstatic delete(adapter: PersistenceAdapter, id: number): Promise<boolean> {\n\t\treturn adapter.delete(tableName, id);\n\t}\n}\n`;
}

function adapterFile(adapter: AdapterName): string {
	if (adapter === 'd1') {
		return d1Adapter();
	}

	if (adapter === 'postgres') {
		return postgresAdapter();
	}

	return sqliteAdapter();
}

function migrationFile(tableName: string, fields: Field[]): string {
	const columns = fields.map((field) => `\t${field.column} ${field.sqlType} NOT NULL`).join(',\n');

	return `CREATE TABLE IF NOT EXISTS ${tableName} (\n\tid INTEGER PRIMARY KEY,\n${columns},\n\tcreated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\n\tupdated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP\n);\n`;
}

function modelTestFile(className: string): string {
	return `import { expect, test } from 'vitest';\nimport { ${className} } from '../../src/models/${className}';\n\ntest('${className} exposes a small ActiveRecord-like API', () => {\n\texpect(${className}.find).toBeTypeOf('function');\n\texpect(${className}.create).toBeTypeOf('function');\n\texpect(${className}.update).toBeTypeOf('function');\n\texpect(${className}.delete).toBeTypeOf('function');\n});\n`;
}

function d1Adapter(): string {
	return `import type { PersistenceAdapter } from './types';\n\nexport function createD1Adapter(db: D1Database): PersistenceAdapter {\n\treturn {\n\t\tfind: async (table, id) => db.prepare(\`SELECT * FROM \${table} WHERE id = ?\`).bind(id).first(),\n\t\tfindBy: async () => [],\n\t\tcreate: async () => { throw new Error('D1 create adapter is generated as a starting point.'); },\n\t\tupdate: async () => null,\n\t\tdelete: async () => false\n\t};\n}\n`;
}

function sqliteAdapter(): string {
	return `import type { PersistenceAdapter } from './types';\n\nexport function createSqliteAdapter(): PersistenceAdapter {\n\treturn {\n\t\tfind: async () => null,\n\t\tfindBy: async () => [],\n\t\tcreate: async () => { throw new Error('SQLite create adapter is generated as a starting point.'); },\n\t\tupdate: async () => null,\n\t\tdelete: async () => false\n\t};\n}\n`;
}

function postgresAdapter(): string {
	return `import type { PersistenceAdapter } from './types';\n\nexport function createPostgresAdapter(): PersistenceAdapter {\n\treturn {\n\t\tfind: async () => null,\n\t\tfindBy: async () => [],\n\t\tcreate: async () => { throw new Error('Postgres create adapter is generated as a starting point.'); },\n\t\tupdate: async () => null,\n\t\tdelete: async () => false\n\t};\n}\n`;
}
