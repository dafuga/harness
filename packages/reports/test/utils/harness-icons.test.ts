import { measureWorkload } from '../../../../test/support/measureWorkload';
import { expect, test } from 'vitest';
import { categoryIcon, harnessIcons, solidIcons } from '../../src/utils/harnessIcons';

const names = Object.keys(harnessIcons);

test('one icon set covers the categories, the two verdicts, contracts, metrics and controls', () =>
	measureWorkload('reports.function.harness-icons', 'layout-catalog-behavior', () => {
		const needed = [
			...['pages', 'components', 'functions', 'configs', 'services'],
			...['passed', 'failed'],
			...['contract', 'file', 'size', 'performance', 'gauge', 'layers', 'tests', 'history'],
			...['relationships', 'environment', 'fixture', 'state', 'route', 'clock', 'branch', 'commit'],
			...['arrow-right', 'arrow-left', 'chevron-right', 'chevron-down', 'search', 'close'],
			...['external', 'expand', 'help', 'grid', 'list', 'link', 'change']
		];
		expect(needed.filter((name) => !names.includes(name))).toEqual([]);
		expect(new Set(names).size).toBe(names.length);
	}));

test('every icon is path data drawn on the same 24 by 24 grid', () => {
	for (const [name, drawing] of Object.entries(harnessIcons)) {
		expect([name, /^M[\d\s.,a-zA-Z-]+$/.test(drawing)]).toEqual([name, true]);
		// No coordinate leaves the grid, so every icon sits in the same box at any size.
		const numbers = drawing.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
		expect([name, numbers.length > 3]).toEqual([name, true]);
		const absolute = drawing.match(/[ML]\s*-?\d+(\.\d+)?[\s,]+-?\d+(\.\d+)?/g) ?? [];
		for (const point of absolute) {
			const [x, y] = point.match(/-?\d+(\.\d+)?/g)!.map(Number);
			expect([name, point, x >= 0 && x <= 24 && y >= 0 && y <= 24]).toEqual([name, point, true]);
		}
	}
});

test('each entity category has its own icon, and only the two verdicts are solid', () => {
	expect(Object.keys(categoryIcon)).toEqual([
		'pages',
		'layouts',
		'components',
		'functions',
		'configs',
		'services',
		'models',
		'types',
		'platforms'
	]);
	const drawings = Object.values(categoryIcon).map((name) => harnessIcons[name]);
	expect(new Set(drawings).size).toBe(9);
	expect([...solidIcons].sort()).toEqual(['failed', 'passed']);
});
