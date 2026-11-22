import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { gameSources } from '../../src/templates/game-authoring/gameSources';

test('Provides the software 3D adapter source', () => {
	const file = 'adapters/Software3dAdapter.types.ts';
	const source = gameSources[file];
	expect(source).toContain('export type Point = [number, number, number];');
	expect(source).toContain('export type Box = { id: string; at: Point; size: Point; color: string };');
	recordExampleCases(
		{
			unitId: 'template.game-sources',
			symbol: 'gameSources',
			state: 'provides-the-software-3d-adapter-source',
			evidence: 'examples-cases',
			file: 'provides-the-software-3d-adapter-source.json'
		},
		[
			{
				name: 'software adapter template declares point and box types',
				input: {},
				output: {
					files: [file],
					lines: [
						'export type Point = [number, number, number];',
						'export type Box = { id: string; at: Point; size: Point; color: string };'
					]
				}
			}
		]
	);
});
