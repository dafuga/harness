import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { classifyPath } from '../../src/utils/development-tooling/classify-path/classifyPath';
import type { PathClass } from '../../src/utils/development-tooling/classify-path/classifyPath.types';

const config = {
	schemaVersion: 1,
	workspaces: [
		{ name: '', root: '.' },
		{ name: 'web', root: 'packages/web' }
	],
	tests: ['test/', 'tests/'],
	global: ['packages/shared/tokens.css'],
	ignored: ['**/*.md', 'specification/features/'],
	references: []
} satisfies Parameters<typeof classifyPath>[1];

function summarize(result: PathClass): PathClass {
	return result;
}

test('Classifies paths by workspace and repository rules', () => {
	const inputs = [
		'src/utils/development-tooling/classify-path/classifyPath.ts',
		'packages/web/src/lib/format.ts',
		'test/unit/classify-path.test.ts',
		'packages/shared/tokens.css',
		'README.md',
		'specification/units/example.json'
	];
	const outputs = inputs.map((path) => summarize(classifyPath(path, config)));
	expect(outputs.map((result) => result.classification)).toEqual([
		'source',
		'source',
		'test',
		'global',
		'ignored',
		'registry'
	]);
	const cases = inputs.map((path, index) => ({
		name: path,
		input: { path, config },
		output: outputs[index]
	}));
	recordExampleCases(
		{
			unitId: 'function.classify-path',
			symbol: 'classifyPath',
			state: 'classifies-paths-by-workspace-and-repository-rules',
			evidence: 'examples-cases',
			file: 'classifies-paths-by-workspace-and-repository-rules.json'
		},
		cases
	);
});
