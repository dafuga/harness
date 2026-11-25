import { describe, expect, test } from 'vitest';
import { deriveContract } from '../src/workflows/development-tooling/load-units/unit-index-service/deriveContract';
import { scanExports } from '../src/utils/development-tooling/scanExports';

const sourceFile = (code: string) => ({
	path: 'src/example.ts',
	exports: scanExports(code).symbols,
	errors: scanExports(code).errors
});

describe('function-typed parameters survive scanning and contract derivation', () => {
	const code = [
		'export function onReady(callback: () => void): void { callback(); }',
		'export function link(find: (id: string) => UnitLink | null): void { find("a"); }',
		'export function step(report: (step: string) => void): void { report("a"); }'
	].join('\n');

	test('the scanner keeps each complete arrow type', () => {
		const types = scanExports(code).symbols.flatMap((symbol) => symbol.inputs.map((i) => i.type));
		expect(types).toEqual([
			'() => void',
			'(id: string) => UnitLink | null',
			'(step: string) => void'
		]);
	});

	test('the derived contract operations keep the same types', () => {
		const contract = deriveContract([sourceFile(code)] as never);
		const types = contract.operations?.flatMap((operation) => operation.inputs.map((i) => i.type));
		expect(types).toEqual([
			'() => void',
			'(id: string) => UnitLink | null',
			'(step: string) => void'
		]);
	});
});
