import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { screenSize } from '../../src/utils/verification-evidence/reportFilter';
import type { Status, Evidence } from './reports.function.report-filter.test.types';

const UNIT_ID = 'reports.function.report-filter';

export function asStatus(value: string): Status {
	return value as Status;
}

export function recordMeta(symbol: string, state: string) {
	return { unitId: UNIT_ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

export function shot(id: string, fields: Partial<Evidence> = {}): Evidence {
	return {
		id,
		title: id,
		category: 'screens',
		file: `${id}.png`,
		status: asStatus('passed'),
		mediaType: 'image',
		phase: 'after',
		...fields
	};
}

test('Classifies viewports by known words before numeric widths', () => {
	const viewports = [
		'iPhone 14',
		'iPad landscape',
		'Laptop 1440',
		'Desktop 390',
		'699 px',
		'700 px',
		'1099 px',
		'1100 px',
		'wide screen',
		''
	];
	const sizes = viewports.map((viewport) => screenSize(shot('viewport', { viewport })));
	expect(sizes).toEqual([
		'mobile',
		'tablet',
		'desktop',
		'desktop',
		'mobile',
		'tablet',
		'tablet',
		'desktop',
		'other',
		'other'
	]);
	recordExampleCases(
		recordMeta('screenSize', 'classifies-viewports-by-known-words-before-numeric-widths'),
		viewports.map((viewport, index) => ({
			name: `viewport "${viewport}"`,
			input: { viewport },
			output: sizes[index]
		}))
	);
});
