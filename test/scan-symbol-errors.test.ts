import { describe, expect, test } from 'vitest';
import type { ExportedSymbol } from '../src/core/development-tooling/sourceTypes';
import { scanSymbolErrors } from '../src/utils/development-tooling/scanSymbolErrors';

const symbol = (name: string) => ({ name }) as ExportedSymbol;

describe('scanSymbolErrors', () => {
	test('records a literal SvelteKit redirect as its thrown Redirect', () => {
		const code = `export function load(): never {\n\tredirect(308, '/harness/reports/' + encodeURIComponent('x'));\n}`;
		const [load] = scanSymbolErrors(code, [symbol('load')]);
		expect(load).toMatchObject({ errors: ['Redirect 308'], errorStatus: 'unknown' });
	});

	test('a bare literal redirect is fully known', () => {
		const [load] = scanSymbolErrors(`export function load() { redirect(308, '/harness'); }`, [
			symbol('load')
		]);
		expect(load).toMatchObject({ errors: ['Redirect 308'], errorStatus: 'found' });
		for (const [call, error] of [
			["error(404, 'Missing')", 'HttpError 404'],
			["fail('Invalid request')", 'ExpectedCliError']
		]) {
			const [result] = scanSymbolErrors(`export function load() { ${call}; }`, [symbol('load')]);
			expect(result).toMatchObject({ errors: [error], errorStatus: 'found' });
		}
	});

	test('a redirect with a computed status stays unknown', () => {
		const [load] = scanSymbolErrors(`export function load(s: number) { redirect(s, '/'); }`, [
			symbol('load')
		]);
		expect(load).toMatchObject({ errors: [], errorStatus: 'unknown' });
	});
});
