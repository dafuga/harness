import { PerformanceProfileService } from '../src/services/PerformanceProfileService';
import { afterAll, expect, test } from 'vitest';
import { evidenceRequested } from '../src/utils/record-capture/recordCapture';
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

// Automatically retain a representative workload when the normal verification requests evidence.
afterAll(async () => {
	if (!evidenceRequested()) return;
	const helpers = { toCamelCase, toKebabCase, toPascalCase, toSnakeCase };
	const expected = {
		toCamelCase: 'helloWorld',
		toKebabCase: 'hello-world',
		toPascalCase: 'HelloWorld',
		toSnakeCase: 'hello_world'
	};
	for (const [callable, transform] of Object.entries(helpers)) {
		expect(transform('Hello world')).toBe(expected[callable as keyof typeof expected]);
		await new PerformanceProfileService().capture(
			{ unit: 'function.case', callable, workload: 'hello-world' },
			() => transform('Hello world')
		);
	}
});
