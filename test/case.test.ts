import { afterAll, expect, test } from 'vitest';
import { evidenceRequested, recordCapture } from '../src/utils/record-capture/recordCapture';
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
afterAll(() => {
	if (!evidenceRequested()) return;
	const helpers = { toCamelCase, toKebabCase, toPascalCase, toSnakeCase };
	const expected = {
		toCamelCase: 'helloWorld',
		toKebabCase: 'hello-world',
		toPascalCase: 'HelloWorld',
		toSnakeCase: 'hello_world'
	};
	const measurements = Object.entries(helpers).flatMap(([callable, transform]) => {
		expect(transform('Hello world')).toBe(expected[callable as keyof typeof expected]);
		for (let warmup = 0; warmup < 3; warmup++) transform('Hello world');
		const rounds = Array.from({ length: 5 }, () => {
			const start = performance.now();
			for (let iteration = 0; iteration < 1000; iteration++) transform('Hello world');
			return (performance.now() - start) / 1000;
		}).sort((a, b) => a - b);
		const context = {
			unit: 'function.case',
			callable,
			workload: 'hello-world',
			target: 'module',
			samples: 5000
		};
		return [
			{
				...context,
				metric: 'latency-warm-ms',
				unitOfMeasure: 'ms',
				value: rounds[2],
				method: 'Median of 5 batches of 1000 direct calls after 3 warmups; input: Hello world.'
			},
			{
				...context,
				metric: 'process-peak-rss-bytes',
				unitOfMeasure: 'bytes',
				value: process.resourceUsage().maxRSS * 1024,
				method:
					'Peak RSS of the whole benchmark process, including the test runner; not memory attributable to this function.'
			}
		];
	});
	recordCapture(
		{
			evidence: 'case-benchmark',
			state: 'representative',
			kind: 'benchmark',
			file: 'case-benchmark.json',
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
});
