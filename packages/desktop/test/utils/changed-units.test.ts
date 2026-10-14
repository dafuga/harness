import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { unitOwners } from '../../../../src/utils/unitOwners';
import { changedUnits } from '../../src/utils/changedUnits';

/**
 * A change names the units whose declared source owns its files, by the registry's own owner
 * rule, and counts the files no unit owns without repeating their paths.
 */
const owners = unitOwners([
	{ id: 'app.function.owned', source: ['src/owned.ts'] },
	{ id: 'app.component.panel', source: ['src/panel/'] },
	{ id: 'app.config.shared', source: ['src/owned.ts', 'src/panel/'] }
]);

test('owned files name their units once each and unowned files are counted', () => {
	const said = changedUnits(['src/owned.ts', 'src/new.ts'], owners);
	expect(said).toBe(
		'Units changed: [[unit:app.config.shared]], [[unit:app.function.owned]]; 1 file outside any unit.'
	);
	expect(said).not.toContain('src/new.ts');
});

test('a directory owns every file under it and a unit owning several files is named once', () => {
	const paths = ['src/panel/view.ts', 'src/panel/deep/style.css', 'src/panelish.ts', 'x.md'];
	expect(changedUnits(paths, owners)).toBe(
		'Units changed: [[unit:app.component.panel]], [[unit:app.config.shared]]; 2 files outside any unit.'
	);
});

test('a change of only unowned files, or of no files, says only what is known', () => {
	expect(changedUnits(['a.ts', 'b.ts'], owners)).toBe('2 files outside any unit.');
	expect(changedUnits([], owners)).toBe('');
	expect(changedUnits(['src/owned.ts'], () => ['Not.An.Id'])).toBe('');
});

test('a notice names at most forty units and counts the rest', () => {
	const many = unitOwners(
		Array.from({ length: 45 }, (_, n) => ({ id: `app.function.f${n}`, source: [`f${n}.ts`] }))
	);
	const said = changedUnits(
		Array.from({ length: 45 }, (_, n) => `f${n}.ts`),
		many
	);
	expect(said.match(/\[\[unit:/g)).toHaveLength(40);
	expect(said.endsWith(', and 5 more.')).toBe(true);
});
