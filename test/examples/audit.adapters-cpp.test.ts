import { auditCase } from './audit.adapters-cpp.fixture';

import { test } from 'vitest';






import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/** The finding the adapter returns for a rule, with its path relative to the project folder. */
function finding(path: string, rule: string, message: string) {
	return { path, rule, message };
}

/** A function with its signature, body lines and closing brace. */
function functionOf(signature: string, body: string[]): string {
	return [signature, ...body, '}'].join('\n');
}

/** Declarations, one per line, so that a source has exactly the given number of lines. */
function declarations(count: number): string {
	return Array.from({ length: count }, (_, index) => `int v${index};`).join('\n');
}

const splitMessage = 'File has 230 lines. Limit is 220. Split it by responsibility.';
const longMessage = 'Block starting near line 1 has 60 lines. Limit is 55.';
const parametersMessage = 'Block starting near line 1 has 5 parameters. Limit is 4.';
const complexityMessage = 'Block starting near line 1 has complexity 12. Limit is 10.';
const nestingMessage = 'Block starting near line 1 has 5 nested levels. Limit is 4.';
const headerMessage = 'Header files should not export using namespace std.';
const includeMessage = 'Avoid parent-directory includes in C/C++ files.';
const header =
	'#pragma once\n\n#include <vector>\n\nusing namespace std;\n\nvector<int> values();\n';
const source = '#include "store.h"\n\nusing namespace std;\n\nint count() {\n\treturn 0;\n}\n';
const longFunction = functionOf(
	'int total(int a) {',
	Array.from({ length: 58 }, (_, index) => `\ta += ${index};`)
);
const branchyFunction = functionOf('int classify(int value) {', [
	...Array.from({ length: 11 }, (_, index) => `\tif (value > ${index}) value -= 1;`),
	'\treturn value;'
]);
const nestedFunction = functionOf('int nest(int value) {', [
	'\tif (value > 0) {',
	'\t\tif (value > 1) {',
	'\t\t\tif (value > 2) {',
	'\t\t\t\tif (value > 3) {',
	'\t\t\t\t\tif (value > 4) {',
	'\t\t\t\t\t\tvalue -= 1;',
	'\t\t\t\t\t}',
	'\t\t\t\t}',
	'\t\t\t}',
	'\t\t}',
	'\t}',
	'\treturn value;'
]);
const manyParameters =
	'int sum(int a, int b, int c, int d, int e) {\n\treturn a + b + c + d + e;\n}\n';

test('Reports a C++ file longer than the file line limit', async () => {
	await withTempDir('cpp-adapter-examples-', async (root) => {
		const cases = [
			await auditCase(
				root,
				'a 230-line source is over the 220-line limit',
				'src/long.cc',
				declarations(230)
			),
			await auditCase(root, 'a 220-line source is at the limit', 'src/limit.cc', declarations(220))
		];
		expect(cases.map((item) => item.output)).toEqual([
			[finding('src/long.cc', 'small-file', splitMessage)],
			[]
		]);
		recordExampleCases(
			{
				unitId: 'audit.adapters-cpp',
				symbol: 'cppAdapter.audit',
				state: 'reports-a-c-file-longer-than-the-file-line-limit',
				evidence: 'examples-cases',
				file: 'reports-a-c-file-longer-than-the-file-line-limit.json'
			},
			cases
		);
	});
});

test('Reports C++ functions over the block limits', async () => {
	await withTempDir('cpp-adapter-examples-', async (root) => {
		const cases = [
			await auditCase(root, 'a 60-line function is over the limit', 'src/total.cc', longFunction),
			await auditCase(root, 'five parameters are over the limit', 'src/sum.cc', manyParameters),
			await auditCase(
				root,
				'eleven branches give complexity twelve',
				'src/classify.cc',
				branchyFunction
			),
			await auditCase(root, 'five nested blocks are over the limit', 'src/nest.cc', nestedFunction)
		];
		expect(cases.map((item) => item.output)).toEqual([
			[finding('src/total.cc', 'small-function', longMessage)],
			[finding('src/sum.cc', 'max-parameters', parametersMessage)],
			[finding('src/classify.cc', 'max-complexity', complexityMessage)],
			[finding('src/nest.cc', 'max-nesting', nestingMessage)]
		]);
		recordExampleCases(
			{
				unitId: 'audit.adapters-cpp',
				symbol: 'cppAdapter.audit',
				state: 'reports-c-functions-over-the-block-limits',
				evidence: 'examples-cases',
				file: 'reports-c-functions-over-the-block-limits.json'
			},
			cases
		);
	});
});

test('Reports using namespace std in every header extension', async () => {
	await withTempDir('cpp-adapter-examples-', async (root) => {
		const cases = [
			await auditCase(root, 'an h header uses namespace std', 'include/store.h', header),
			await auditCase(root, 'an hh header uses namespace std', 'include/store.hh', header),
			await auditCase(root, 'an hpp header uses namespace std', 'include/store.hpp', header),
			await auditCase(root, 'an hxx header uses namespace std', 'include/store.hxx', header)
		];
		expect(cases.map((item) => item.output)).toEqual([
			[finding('include/store.h', 'cpp-header-namespace', headerMessage)],
			[finding('include/store.hh', 'cpp-header-namespace', headerMessage)],
			[finding('include/store.hpp', 'cpp-header-namespace', headerMessage)],
			[finding('include/store.hxx', 'cpp-header-namespace', headerMessage)]
		]);
		recordExampleCases(
			{
				unitId: 'audit.adapters-cpp',
				symbol: 'cppAdapter.audit',
				state: 'reports-using-namespace-std-in-every-header-extension',
				evidence: 'examples-cases',
				file: 'reports-using-namespace-std-in-every-header-extension.json'
			},
			cases
		);
	});
});

test('Leaves using namespace std alone in a source file', async () => {
	await withTempDir('cpp-adapter-examples-', async (root) => {
		const cases = [
			await auditCase(root, 'a cc source uses namespace std', 'src/store.cc', source),
			await auditCase(root, 'a cpp source uses namespace std', 'src/store.cpp', source)
		];
		expect(cases.map((item) => item.output)).toEqual([[], []]);
		recordExampleCases(
			{
				unitId: 'audit.adapters-cpp',
				symbol: 'cppAdapter.audit',
				state: 'leaves-using-namespace-std-alone-in-a-source-file',
				evidence: 'examples-cases',
				file: 'leaves-using-namespace-std-alone-in-a-source-file.json'
			},
			cases
		);
	});
});

test('Reports an include that climbs to a parent folder', async () => {
	await withTempDir('cpp-adapter-examples-', async (root) => {
		const cases = [
			await auditCase(
				root,
				'a source includes a parent folder header',
				'src/app/main.cc',
				'#include "../core/clock.h"\n\nint main() {\n\treturn 0;\n}\n'
			),
			await auditCase(
				root,
				'a header includes a parent folder header',
				'include/app/app.hpp',
				'#pragma once\n\n#include "../core/clock.hpp"\n'
			),
			await auditCase(
				root,
				'a source includes a sibling and a system header',
				'src/app/clock.cc',
				'#include "clock.h"\n#include <vector>\n'
			)
		];
		expect(cases.map((item) => item.output)).toEqual([
			[finding('src/app/main.cc', 'cpp-include-direction', includeMessage)],
			[finding('include/app/app.hpp', 'cpp-include-direction', includeMessage)],
			[]
		]);
		recordExampleCases(
			{
				unitId: 'audit.adapters-cpp',
				symbol: 'cppAdapter.audit',
				state: 'reports-an-include-that-climbs-to-a-parent-folder',
				evidence: 'examples-cases',
				file: 'reports-an-include-that-climbs-to-a-parent-folder.json'
			},
			cases
		);
	});
});
