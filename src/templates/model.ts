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
	const fieldLines = fields.map((field) => `\t${field.name}: ${field.tsType};`);
	const attributeLines = [
		'\tid: number;',
		...fieldLines,
		'\tcreatedAt: string;',
		'\tupdatedAt: string;'
	];

	return `export interface ${className}Attributes {\n${attributeLines.join('\n')}\n}\n\nexport type ${className}CreateInput = Omit<${className}Attributes, 'id' | 'createdAt' | 'updatedAt'>;\nexport type ${className}UpdateInput = Partial<${className}CreateInput>;\n`;
}

function modelFile(className: string, tableName: string): string {
	const createMethod = modelCreateMethod(className);

	return `import type { PersistenceAdapter } from './adapters/types';
import type { ${className}Attributes, ${className}CreateInput, ${className}UpdateInput } from './${className}.types';

const tableName = '${tableName}';

export class ${className} {
	static find(adapter: PersistenceAdapter, id: number): Promise<${className}Attributes | null> {
		return adapter.find(tableName, id);
	}

	static findBy(
		adapter: PersistenceAdapter,
		fields: Partial<${className}Attributes>
	): Promise<${className}Attributes[]> {
		return adapter.findBy(tableName, fields);
	}

${createMethod}

	static update(
		adapter: PersistenceAdapter,
		id: number,
		input: ${className}UpdateInput
	): Promise<${className}Attributes | null> {
		return adapter.update(tableName, id, input);
	}

	static delete(adapter: PersistenceAdapter, id: number): Promise<boolean> {
		return adapter.delete(tableName, id);
	}
}
`;
}

function modelCreateMethod(className: string): string {
	const oneLineSignature = `static create(adapter: PersistenceAdapter, input: ${className}CreateInput): Promise<${className}Attributes> {`;

	if (oneLineSignature.length <= 97) {
		return `\t${oneLineSignature}\n\t\treturn adapter.create(tableName, input);\n\t}`;
	}

	return `\tstatic create(\n\t\tadapter: PersistenceAdapter,\n\t\tinput: ${className}CreateInput\n\t): Promise<${className}Attributes> {\n\t\treturn adapter.create(tableName, input);\n\t}`;
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
	const columns = [
		'\tid INTEGER PRIMARY KEY',
		...fields.map((field) => `\t${field.column} ${field.sqlType} NOT NULL`),
		'\tcreated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
		'\tupdated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'
	];

	return `-- reversible: DROP TABLE IF EXISTS ${tableName};\nCREATE TABLE IF NOT EXISTS ${tableName} (\n${columns.join(',\n')}\n);\n`;
}

function modelTestFile(className: string): string {
	return `import { expect, test } from 'vitest';\nimport { ${className} } from '../../src/models/${className}';\n\ntest('${className} exposes a small ActiveRecord-like API', () => {\n\texpect(${className}.find).toBeTypeOf('function');\n\texpect(${className}.create).toBeTypeOf('function');\n\texpect(${className}.update).toBeTypeOf('function');\n\texpect(${className}.delete).toBeTypeOf('function');\n});\n`;
}

function d1Adapter(): string {
	return `import type { PersistenceAdapter } from './types';

export interface D1LikeDatabase {
	prepare(query: string): {
		bind(...values: unknown[]): {
			first<T>(): Promise<T | null>;
		};
	};
}

export function createD1Adapter(db: D1LikeDatabase): PersistenceAdapter {
	return {
		find: async (table, id) => db.prepare(\`SELECT * FROM \${table} WHERE id = ?\`).bind(id).first(),
		findBy: async () => [],
		create: async () => {
			throw new Error('D1 create adapter is generated as a starting point.');
		},
		update: async () => null,
		delete: async () => false
	};
}
`;
}

function sqliteAdapter(): string {
	return `import type { PersistenceAdapter } from './types';

export function createSqliteAdapter(): PersistenceAdapter {
	return {
		find: async () => null,
		findBy: async () => [],
		create: async () => {
			throw new Error('SQLite create adapter is generated as a starting point.');
		},
		update: async () => null,
		delete: async () => false
	};
}
`;
}

function postgresAdapter(): string {
	return `import type { PersistenceAdapter } from './types';

export function createPostgresAdapter(): PersistenceAdapter {
	return {
		find: async () => null,
		findBy: async () => [],
		create: async () => {
			throw new Error('Postgres create adapter is generated as a starting point.');
		},
		update: async () => null,
		delete: async () => false
	};
}
`;
}
