import { expect, test } from 'vitest';
import { toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from '../src/core/case';

test('normalizes names across common code shapes', () => {
	expect(toPascalCase('blog-post')).toBe('BlogPost');
	expect(toCamelCase('Blog post')).toBe('blogPost');
	expect(toKebabCase('BlogPost')).toBe('blog-post');
	expect(toSnakeCase('BlogPost')).toBe('blog_post');
});
