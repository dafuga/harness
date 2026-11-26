import type { VerificationSeed } from '../../scripts/harness-emitted-seed.types';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { seedEmitted } from '../../scripts/harness-emitted-seed';

import type { VerifyRepo } from '../../../../test/support/verifyRepo';

function project(root: string): VerifyRepo {
	const files = new Map<string, string>([
		['harness.verify.json', '{}'],
		['specification/units/function.packer.json', '{"runtime":{"targets":[]}}'],
		[
			'src/utils/packer.ts',
			'// build: p3 w5\nexport function packer(value: string): string {\n\treturn value.toLowerCase();\n}\n'
		]
	]);
	let commits = 0;
	const project = {
		root,
		async write(path: string, contents: string) {
			files.set(path, contents);
			const fullPath = join(root, path);
			mkdirSync(join(fullPath, '..'), { recursive: true });
			writeFileSync(fullPath, contents);
		},
		async read(path: string) {
			return files.get(path) ?? readFileSync(join(root, path), 'utf8');
		},
		async json<T>(path: string): Promise<T> {
			return JSON.parse(files.get(path) ?? '{}') as T;
		},
		async harness() {
			return { exitCode: 0, stdout: '', stderr: '' };
		},
		async commit() {
			commits += 1;
			return commits.toString(16).padStart(40, '0');
		},
		async verify() {
			return { exitCode: 0, stderr: '', record: { id: `record-${commits}` }, directory: root };
		}
	};
	return project as unknown as VerifyRepo;
}

test('Records the emitted unit through each build stage', async () => {
	const root = mkdtempSync(join(tmpdir(), 'emitted-seed-'));
	try {
		const repo = project(root);
		const verified: VerificationSeed['verified'] = (current) => current.verify();
		const explain: VerificationSeed['explain'] = async () => ({
			exitCode: 0,
			stdout: '',
			stderr: ''
		});
		const output = await seedEmitted(repo, { verified, explain });
		expect(Object.keys(output)).toEqual(['emitting', 'packed', 'swapped', 'repacked', 'vanished']);
		expect(Object.values(output)).toHaveLength(5);
		recordExampleCases(
			{
				unitId: 'reports.script.harness-emitted-seed',
				symbol: 'seedEmitted',
				state: 'records-the-emitted-unit-through-each-build-stage',
				evidence: 'examples-cases',
				file: 'records-the-emitted-unit-through-each-build-stage.json'
			},
			[
				{
					name: 'returns commit ids for all five emitted stages',
					input: { unit: 'function.packer', targets: ['process', 'wasm'] },
					output
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
