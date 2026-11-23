import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	presentUnits,
	requiredReasons,
	reasonDeclarationHash
} from '../../src/utils/development-tooling/required-reasons/requiredReasons';
import type {
	CompactReasonManifest,
	ReasonSide
} from '../../src/utils/development-tooling/required-reasons/requiredReasons.types';

const manifest = (id: string, status: 'active' | 'retired', source: string[]) =>
	({
		id,
		status,
		owns: { source },
		declarationHash: 'a1b2c3d4e5f60718'
	}) satisfies CompactReasonManifest;

const side = (manifests: CompactReasonManifest[], files: Array<[string, string]>): ReasonSide => ({
	manifests,
	index: {
		files: new Map(files.map(([path, hash]) => [path, { hash, blocks: [] }]))
	}
});

test('Tracks present units and whole-unit additions and removals', () => {
	const oldManifest = manifest('function.old', 'active', ['src/old.ts']);
	const retired = manifest('function.retired', 'retired', ['src/retired.ts']);
	const newManifest = manifest('function.new', 'active', ['src/new.ts']);
	const base = side(
		[oldManifest, retired],
		[
			['src/old.ts', 'old-source-hash'],
			['src/retired.ts', 'retired-hash']
		]
	);
	const head = side([newManifest], [['src/new.ts', 'new-source-hash']]);
	const present = [...presentUnits(base).keys()];
	const reasons = requiredReasons(base, head);
	const declarationHash = reasonDeclarationHash(newManifest);

	expect(present).toEqual(['function.old']);
	expect(reasons.map(({ unit, symbol, change }) => ({ unit, symbol, change }))).toEqual([
		{ unit: 'function.new', symbol: '*', change: 'added' },
		{ unit: 'function.old', symbol: '*', change: 'removed' }
	]);
	expect(declarationHash).toBe('a1b2c3d4e5f60718');
	recordExampleCases(
		{
			unitId: 'function.required-reasons',
			symbol: 'requiredReasons',
			state: 'tracks-present-units-and-whole-unit-additions-and-removals',
			evidence: 'examples-cases',
			file: 'tracks-present-units-and-whole-unit-additions-and-removals.json'
		},
		[
			{
				name: 'active source is present while retired unit is excluded',
				input: { manifests: [oldManifest, retired], filePaths: ['src/old.ts', 'src/retired.ts'] },
				output: { present, ids: present }
			},
			{
				name: 'revision comparison reports sorted whole-unit addition and removal',
				input: { base: ['function.old'], head: ['function.new'] },
				output: { reasons, declarationHash }
			}
		]
	);
});
