import { expect, test } from 'vitest';
import { BenchmarkRepository } from '../../src/repositories/agents-providers/BenchmarkRepository';

test('benchmark run paths reject traversal and arbitrary paths', () => {
	const repository = new BenchmarkRepository('/tmp/test');
	expect(() => repository.directory('../other')).toThrow();
	expect(() => repository.directory('/tmp/other')).toThrow();
});
