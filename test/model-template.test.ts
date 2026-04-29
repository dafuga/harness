import { expect, test } from 'vitest';
import { parseFields } from '../src/core/fields';
import { modelFiles } from '../src/templates/model';

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

test('model migrations are valid when no fields are provided', () => {
	const files = modelFiles({ name: 'Post', fields: parseFields([]), adapter: 'sqlite' });
	const migration = files.find((file) => file.path === 'db/migrations/create_posts.sql')?.contents;

	expect(migration).toContain('id INTEGER PRIMARY KEY');
	expect(migration).not.toContain(',\n,\n');
});
