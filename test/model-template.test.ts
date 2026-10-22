import { expect, test } from 'vitest';
import { parseFields } from '../src/core/development-tooling/fields/fields';
import { modelFiles } from '../src/templates/development-tooling/model';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { generateModel } from '../src/workflows/projects-sessions/generate-code/generateCode';
import { runCommand } from './support/cli';
import { sqliteModelConsumer } from './support/sqliteModelConsumer';

test('model generator creates model, migration, adapter, and test files', () => {
	const files = modelFiles({
		name: 'BlogPost',
		fields: parseFields(['title:string', 'body:text']),
		adapter: 'sqlite'
	});
	const paths = files.map((file) => file.path);

	expect(paths).toContain('src/models/BlogPost.ts');
	expect(paths).toContain('src/models/BlogPost.types.ts');
	expect(paths).toContain('src/models/adapters/sqlite.ts');
	expect(paths).toContain('db/migrations/create_blog_posts.sql');
	expect(paths).toContain('test/models/blog-post.test.ts');
});

test('model generator supports every adapter and avoids ambient D1 types', () => {
	const d1 = modelFiles({ name: 'Post', fields: parseFields([]), adapter: 'd1' });
	const sqlite = modelFiles({ name: 'Post', fields: parseFields([]), adapter: 'sqlite' });
	const postgres = modelFiles({ name: 'Post', fields: parseFields([]), adapter: 'postgres' });
	const d1Adapter = d1.find((file) => file.path === 'src/models/adapters/d1.ts')?.contents;

	expect(d1Adapter).toContain('D1LikeDatabase');
	expect(d1Adapter).not.toContain('D1Database');
	expect(sqlite.map((file) => file.path)).toContain('src/models/adapters/sqlite.ts');
	expect(postgres.map((file) => file.path)).toContain('src/models/adapters/postgres.ts');
});

test('only SQLite models declare the table definition their generated adapter maps', () => {
	const fields = parseFields(['ownerName:string', 'active:boolean', 'metadata:json']);
	const sqlite = modelFiles({ name: 'BlogPost', fields, adapter: 'sqlite' });
	const model = sqlite.find((file) => file.path === 'src/models/BlogPost.ts')?.contents;
	const adapter = sqlite.find((file) => file.path === 'src/models/adapters/sqlite.ts')?.contents;

	expect(model).toContain("table: 'blog_posts'");
	expect(model).toContain("ownerName: { type: 'string', column: 'owner_name' }");
	expect(model).toContain("active: { type: 'boolean', column: 'active' }");
	expect(model).toContain("metadata: { type: 'json', column: 'metadata' }");
	expect(adapter).toContain("from '@dafuga01/harness/sqlite'");
	expect(adapter).not.toContain('starting point');
	for (const other of ['d1', 'postgres'] as const) {
		const files = modelFiles({ name: 'BlogPost', fields, adapter: other });
		const contents = files.find((file) => file.path === 'src/models/BlogPost.ts')?.contents;
		expect(contents).not.toContain('definition');
	}
});

test('model migrations are valid when no fields are provided', () => {
	const files = modelFiles({ name: 'Post', fields: parseFields([]), adapter: 'sqlite' });
	const migration = files.find((file) => file.path === 'db/migrations/create_posts.sql')?.contents;

	expect(migration).toContain('id INTEGER PRIMARY KEY');
	expect(migration).not.toContain(',\n,\n');
});

test('generated SQLite models persist typed CRUD through the reusable adapter', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-sqlite-model-'));
	try {
		await generateModel({
			root,
			name: 'BlogPost',
			adapter: 'sqlite',
			rawFields: ['title:string', 'ownerName:string', 'active:boolean', 'metadata:json']
		});
		const dependency = join(root, 'node_modules/@dafuga01/harness');
		await mkdir(dependency, { recursive: true });
		await writeFile(
			join(dependency, 'package.json'),
			JSON.stringify({
				name: '@dafuga01/harness',
				type: 'module',
				exports: { './sqlite': './sqlite.ts' }
			})
		);
		await writeFile(
			join(dependency, 'sqlite.ts'),
			`export * from ${JSON.stringify(resolve('src/lib/development-tooling/sqlite.ts'))};`
		);
		await writeFile(join(root, 'consumer.ts'), sqliteModelConsumer);
		const result = await runCommand(['bun', 'consumer.ts'], root, false);
		expect(result.stderr).toBe('');
		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({ persisted: true, deleted: true });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
