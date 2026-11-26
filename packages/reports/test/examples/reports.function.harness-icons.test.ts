import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { categoryIcon, harnessIcons, solidIcons } from '../../src/utils/explorer-ui/harnessIcons';
import type { Cases } from './reports.function.harness-icons.test.types';
const unitId = 'reports.function.harness-icons';
const record = (symbol: string, state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);

const categories = [
	'pages',
	'apis',
	'layouts',
	'components',
	'functions',
	'configs',
	'services',
	'models',
	'types',
	'platforms'
];
const pathData = /^M[\d\s.,a-zA-Z-]+$/;
const absolutePoint = /[ML]\s*-?\d+(\.\d+)?[\s,]+-?\d+(\.\d+)?/g;

/** Whether a drawing is path data and each of its absolute points lies on the 24 by 24 grid. */
function gridCheck(drawing: string) {
	const points = drawing.match(absolutePoint) ?? [];
	const outside = points.filter((point) => {
		const [x, y] = point.match(/-?\d+(\.\d+)?/g)!.map(Number);
		return !(x >= 0 && x <= 24 && y >= 0 && y <= 24);
	});
	return { path: pathData.test(drawing), points: points.length, outside };
}

test('Every icon is path data on the 24 by 24 grid', () => {
	const checks = Object.entries(harnessIcons).map(([name, drawing]) => ({
		name,
		...gridCheck(drawing)
	}));
	expect(checks.filter(({ path, outside }) => !path || outside.length > 0)).toEqual([]);
	record(
		'harnessIcons',
		'every-icon-is-path-data-on-the-grid',
		checks.map(({ name, path, points, outside }) => ({
			name,
			input: name,
			output: { path, points, outside }
		}))
	);
});

test('Only the passed and failed verdicts are solid', () => {
	const members = [...solidIcons].sort();
	expect(solidIcons).toBeInstanceOf(Set);
	expect(members).toEqual(['failed', 'passed']);
	const solid = new Set<string>(solidIcons);
	const outlined = Object.keys(harnessIcons).filter((name) => !solid.has(name));
	expect(outlined).not.toContain('passed');
	expect(outlined).not.toContain('failed');
	record('solidIcons', 'only-the-passed-and-failed-verdicts-are-solid', [
		{ name: 'solidIcons members', input: 'solidIcons', output: { isSet: true, members } },
		{
			name: 'icons outside the solid set',
			input: 'harnessIcons keys not in solidIcons',
			output: {
				count: outlined.length,
				verdictsOutlined: ['passed', 'failed'].filter((name) => outlined.includes(name))
			}
		}
	]);
});

test('Each entity category maps to its own catalog icon', () => {
	const mapped = Object.entries(categoryIcon);
	expect(mapped.map(([category]) => category)).toEqual(categories);
	const drawings = mapped.map(([, icon]) => harnessIcons[icon]);
	expect(drawings.every((drawing) => typeof drawing === 'string')).toBe(true);
	expect(new Set(drawings).size).toBe(categories.length);
	record(
		'categoryIcon',
		'each-entity-category-maps-to-its-own-catalog-icon',
		mapped.map(([category, icon]) => ({
			name: category,
			input: category,
			output: { icon, drawn: typeof harnessIcons[icon] === 'string' }
		}))
	);
});
