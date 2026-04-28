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
