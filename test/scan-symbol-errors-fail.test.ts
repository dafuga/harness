import { describe, expect, test } from 'vitest';
import type { ExportedSymbol } from '../src/core/development-tooling/sourceTypes';
import { callsCliFail, scanSymbolErrors } from '../src/utils/development-tooling/scanSymbolErrors';

const symbol = (name: string) => ({ name }) as ExportedSymbol;
const scan = (code: string) => scanSymbolErrors(code, [symbol('run')])[0];
const cli = `import { fail } from '../core/errors';\n`;

describe('scanSymbolErrors fail binding', () => {
	describe('resolution', () => {
		test('an aliased CLI import is the CLI error', () => {
			const code = `import { fail as stop } from '../core/development-tooling/errors';\nexport function run() { stop('x'); }`;
			expect(scan(code)).toMatchObject({ errors: ['ExpectedCliError'], errorStatus: 'found' });
		});

		test('a fail imported from another module is not attributed to the CLI', () => {
			const code = `import { fail } from './parseCollaborationInput';\nexport function run() { fail('x'); }`;
			expect(scan(code)).toMatchObject({ errors: [], errorStatus: 'unknown' });
		});

		test('an unbound fail is not attributed to the CLI', () => {
			expect(scan(`export function run() { fail('x'); }`)).toMatchObject({
				errors: [],
				errorStatus: 'unknown'
			});
		});

		test('a same-file fail reports what its own body throws', () => {
			const code = `function fail(m: string): never { throw new SealedError(m); }\nexport function run() { fail('x'); }`;
			expect(scan(code)).toMatchObject({ errors: ['SealedError'], errorStatus: 'found' });
		});
	});

	describe('fail shadowing', () => {
		test('a parameter or local named fail shadows the CLI import', () => {
			const param = `${cli}export function run(fail: (m: string) => void) { fail('x'); }`;
			expect(scan(param)).toMatchObject({ errors: [], errorStatus: 'unknown' });
			const local = `${cli}export function run() { const fail = log; fail('x'); }`;
			expect(scan(local)).toMatchObject({ errors: [], errorStatus: 'unknown' });
		});

		test('file-level detection follows the same binding', () => {
			expect(callsCliFail(`${cli}export function run() { fail('x'); }`)).toBe(true);
			expect(callsCliFail(`export function run() { fail('x'); }`)).toBe(false);
			expect(callsCliFail(`${cli}export function run(fail: () => void) { fail(); }`)).toBe(false);
			expect(callsCliFail(`${cli}export class Box { run() { this.fail('x'); } }`)).toBe(false);
		});

		test('this.fail stays an indirect call', () => {
			const code = `${cli}export class Box { run() { return this.fail('x'); } }`;
			const [run] = scanSymbolErrors(code, [symbol('Box.run')]);
			expect(run).toMatchObject({ errors: [], errorStatus: 'unknown' });
		});
	});
});
