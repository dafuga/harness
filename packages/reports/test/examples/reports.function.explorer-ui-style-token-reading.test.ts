import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { discoverTokens } from '../../src/components/explorer-ui/styleTokenReading';
import type {
	Decls,
	Sheet,
	RuleData,
	SheetData
} from './reports.function.explorer-ui-style-token-reading.test.types';

function fakeStyle(decls: Decls) {
	const names = Object.keys(decls);
	return {
		length: names.length,
		item: (index: number) => names[index],
		getPropertyValue: (name: string) => decls[name] ?? ''
	};
}

// Constructors that only exist so that `instanceof CSSStyleRule` / `instanceof CSSImportRule` hold.
const StyleRuleType = function StyleRuleType() {};
const ImportRuleType = function ImportRuleType() {};

function instanceOf(proto: object, fields: Record<string, unknown>): unknown {
	return Object.assign(Object.create(proto) as object, fields);
}

function crossOriginSheet(): Sheet {
	const sheet: Sheet = { cssRules: [] };
	Object.defineProperty(sheet, 'cssRules', {
		get: () => {
			throw new Error('SecurityError');
		}
	});
	return sheet;
}

function toRule(rule: RuleData): unknown {
	if ('imports' in rule)
		return instanceOf(ImportRuleType.prototype, { styleSheet: toSheet(rule.imports) });
	if ('group' in rule) return { cssRules: rule.group.map(toRule) };
	return instanceOf(StyleRuleType.prototype, {
		selectorText: rule.selector,
		style: fakeStyle(rule.decls)
	});
}

function toSheet(sheet: SheetData): Sheet {
	if ('crossOrigin' in sheet) return crossOriginSheet();
	return { cssRules: sheet.rules.map(toRule) };
}

/** Installs fake browser globals for the call only, then restores the previous ones. */
function withFakeDom<T>(sheets: SheetData[], computed: Decls, run: () => T): T {
	const globals: Record<string, unknown> = {
		document: { styleSheets: sheets.map(toSheet), documentElement: {} },
		getComputedStyle: () => ({ getPropertyValue: (name: string) => computed[name] ?? '' }),
		CSSStyleRule: StyleRuleType,
		CSSImportRule: ImportRuleType
	};
	const saved = Object.keys(globals).map(
		(key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const
	);
	for (const [key, value] of Object.entries(globals)) {
		Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
	}
	try {
		return run();
	} finally {
		for (const [key, descriptor] of saved) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else delete (globalThis as Record<string, unknown>)[key];
		}
	}
}

test('Lists root tokens in declaration order with resolved values', () => {
	const sheets: SheetData[] = [
		{
			rules: [
				{
					selector: ':root',
					decls: {
						'--hx-color-primary': '#1d4ed8',
						'--hx-color-primary-soft':
							'color-mix(in srgb,  var(--hx-color-primary) 12%, transparent)',
						'--hx-space-inline': '8px'
					}
				},
				{ selector: '.card', decls: { '--hx-card-only': '1px' } }
			]
		}
	];
	const computed = {
		'--hx-color-primary': '#1d4ed8',
		'--hx-color-primary-soft': 'color-mix(in srgb, #1d4ed8 12%, transparent)'
	};
	const tokens = withFakeDom(sheets, computed, () => discoverTokens());
	expect(tokens).toEqual([
		{ name: '--hx-color-primary', value: '#1d4ed8', resolved: '#1d4ed8', group: 'Colors' },
		{
			name: '--hx-color-primary-soft',
			value: 'color-mix(in srgb, var(--hx-color-primary) 12%, transparent)',
			resolved: 'color-mix(in srgb, #1d4ed8 12%, transparent)',
			group: 'Colors'
		},
		{
			name: '--hx-space-inline',
			value: '8px',
			resolved: '8px',
			group: 'Spacing and corners'
		}
	]);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-style-token-reading',
			symbol: 'discoverTokens',
			state: 'lists-root-tokens-in-declaration-order-with-resolved-values',
			evidence: 'examples-cases',
			file: 'lists-root-tokens-in-declaration-order-with-resolved-values.json'
		},
		[
			{
				name: 'root declares colour, derived and spacing tokens',
				input: { sheets, computed },
				output: tokens
			}
		]
	);
});

test('Follows imported sheets and keeps the first root declaration', () => {
	const sheets: SheetData[] = [
		{
			rules: [
				{ selector: ':root', decls: { '--hx-radius-panel': '12px' } },
				{
					imports: {
						rules: [
							{
								selector: ':root',
								decls: {
									'--hx-radius-panel': '99px',
									'--hx-font-family-body': 'Inter,   system-ui, sans-serif'
								}
							}
						]
					}
				},
				{ group: [{ selector: ':root', decls: { '--hx-color-primary': '#fff' } }] }
			]
		},
		{ crossOrigin: true }
	];
	const tokens = withFakeDom(sheets, {}, () => discoverTokens());
	expect(tokens).toEqual([
		{ name: '--hx-radius-panel', value: '12px', resolved: '12px', group: 'Spacing and corners' },
		{
			name: '--hx-font-family-body',
			value: 'Inter, system-ui, sans-serif',
			resolved: 'Inter, system-ui, sans-serif',
			group: 'Typography'
		},
		{ name: '--hx-color-primary', value: '#fff', resolved: '#fff', group: 'Colors' }
	]);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-style-token-reading',
			symbol: 'discoverTokens',
			state: 'follows-imported-sheets-and-keeps-the-first-root-declaration',
			evidence: 'examples-cases',
			file: 'follows-imported-sheets-and-keeps-the-first-root-declaration.json'
		},
		[
			{
				name: 'imported root rule repeats a token and a cross-origin sheet is present',
				input: { sheets, computed: {} },
				output: tokens
			}
		]
	);
});

test('Contributes nothing when no root token is readable', () => {
	const sheets: SheetData[] = [
		{ crossOrigin: true },
		{
			rules: [
				{ selector: '.card', decls: { '--hx-card-only': '1px' } },
				{ selector: ':root', decls: { color: 'red' } }
			]
		}
	];
	const tokens = withFakeDom(sheets, {}, () => discoverTokens());
	expect(tokens).toEqual([]);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-style-token-reading',
			symbol: 'discoverTokens',
			state: 'contributes-nothing-when-no-root-token-is-readable',
			evidence: 'examples-cases',
			file: 'contributes-nothing-when-no-root-token-is-readable.json'
		},
		[
			{
				name: 'unreadable sheet, non-root rule and non-token root property',
				input: { sheets, computed: {} },
				output: tokens
			}
		]
	);
});
