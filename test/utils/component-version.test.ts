import { expect, test } from 'vitest';
import { componentVersion } from '../../src/utils/componentVersion';
import { indexFiles, unitOf } from '../support/memoryTree';

const path = 'src/utils/rank.ts';
const original = 'export function rank(value: number): number {\n\treturn value;\n}\n';

async function versionOf(source: string) {
	const indexed = await indexFiles({ [path]: source });
	return componentVersion(unitOf(indexed, 'function.rank'), indexed.index.files);
}

test('componentVersion identifies a unit by manifest, source, contract and runtime hashes', async () => {
	const version = await versionOf(original);
	expect(version.unit).toBe('function.rank');
	for (const hash of [version.manifest, version.source, version.contract, version.runtime]) {
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	}
	expect(version.files).toEqual([{ path, hash: expect.stringMatching(/^[0-9a-f]{40}$/) }]);
	expect(await versionOf(original)).toEqual(version);
});

test('an implementation change moves only the source identity', async () => {
	const before = await versionOf(original);
	const after = await versionOf(original.replace('return value;', 'return value * 2;'));
	expect(after.source).not.toBe(before.source);
	expect(after.files[0].hash).not.toBe(before.files[0].hash);
	expect([after.contract, after.manifest, after.runtime]).toEqual([
		before.contract,
		before.manifest,
		before.runtime
	]);
});

test('a signature change moves the contract and manifest identities', async () => {
	const before = await versionOf(original);
	const after = await versionOf(original.replace('value: number)', 'value: number, floor = 0)'));
	expect(after.contract).not.toBe(before.contract);
	expect(after.manifest).not.toBe(before.manifest);
	expect(after.runtime).toBe(before.runtime);
});
