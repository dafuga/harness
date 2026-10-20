import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { runCommand, runHarness } from './cli';
import { sqliteModelConsumer } from './sqliteModelConsumer';

const consumer = `
import { createRequire } from 'node:module';
import { createSqliteAdapter, type SqliteDatabase } from '@dafuga01/harness/sqlite';
import { CatalogRepository, catalogModels } from '@dafuga01/harness/catalog';
const require = createRequire(import.meta.url);
const Driver = process.versions.bun ? require('bun:sqlite').Database : require('node:sqlite').DatabaseSync;
const db: SqliteDatabase = new Driver(':memory:');
const definition = {table: 'notes', fields: {id: {type: 'string'}, enabled: {type: 'boolean'}, data: {type: 'json'}}} as const;
const adapter = createSqliteAdapter(db, [definition]);
adapter.createTables();
adapter.assertModels();
const created = await adapter.create<{id: string; enabled: boolean; data: {answer: number}}>('notes', {id: 'one', enabled: true, data: {answer: 42}});
if (created.data.answer !== 42 || created.enabled !== true) throw new Error('Packed SQLite field mapping failed');
db.close();
const catalogDb: SqliteDatabase = new Driver(':memory:');
const catalog = new CatalogRepository(catalogDb);
if (catalog.entities().length !== 0) throw new Error('Empty catalog contained entities');
catalogDb.close();
console.log(JSON.stringify({created: true, tables: catalogModels.length}));
`;

/** Uses installed tarball exports, then executes an actual generated consumer model. */
export async function expectPackagedSqlite(project: string): Promise<void> {
	await writeFile(join(project, 'sqlite-consumer.ts'), consumer);
	const options = [
		'--noEmit',
		'--strict',
		'--target',
		'ES2022',
		'--moduleResolution',
		'Bundler',
		'--module',
		'ESNext'
	];
	await runCommand(['bun', 'x', 'tsc', ...options, 'sqlite-consumer.ts'], project);
	for (const runner of ['bun', 'node']) {
		const result = await runCommand([runner, 'sqlite-consumer.ts'], project);
		expect(JSON.parse(result.stdout)).toEqual({ created: true, tables: 8 });
	}
	await runHarness(
		[
			'generate',
			'model',
			'BlogPost',
			'title:string',
			'ownerName:string',
			'active:boolean',
			'metadata:json',
			'--adapter',
			'sqlite'
		],
		project
	);
	await writeFile(join(project, 'generated-sqlite.ts'), sqliteModelConsumer);
	const generated = await runCommand(['bun', 'generated-sqlite.ts'], project);
	expect(JSON.parse(generated.stdout)).toEqual({ persisted: true, deleted: true });
}
