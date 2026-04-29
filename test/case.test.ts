import { expect, test } from 'vitest';
import { toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from '../src/core/case';

test('normalizes names across common code shapes', () => {
	expect(toPascalCase('blog-post')).toBe('BlogPost');
	expect(toCamelCase('Blog post')).toBe('blogPost');
	expect(toKebabCase('BlogPost')).toBe('blog-post');
	expect(toSnakeCase('BlogPost')).toBe('blog_post');
});

test('drops extra separators while preserving numbers', () => {
	expect(toPascalCase('  api__v2 report  ')).toBe('ApiV2Report');
	expect(toCamelCase('API v2 report')).toBe('apiV2Report');
	expect(toKebabCase('API v2 report')).toBe('api-v2-report');
	expect(toSnakeCase('API v2 report')).toBe('api_v2_report');
});
