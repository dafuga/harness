import { expect, test } from 'vitest';
import {
	uiDesignPatternRules,
	uiDesignRules
} from '../src/templates/development-tooling/uiDesignGuidance';

const rules = [
	'List cards never contain forms',
	'one-line option chips',
	'two to four columns on desktop and tablet',
	'one column at phone widths',
	'Other… tile opens a dialog',
	'Render explicit HTTP and HTTPS URLs',
	'rel="noopener noreferrer"',
	'bottom-right overlay on desktop',
	'A floating button never covers content or another control',
	'Absence is not failure',
	'Pickers use the shared list rows, never a native list box',
	'One composer: modes always read Comment · Ask · Plan · Change',
	'A gate page has one heading'
];

test('Emits the design rules into the shared UI design guidance', () => {
	for (const fragment of rules) {
		expect(uiDesignPatternRules.some((rule) => rule.includes(fragment))).toBe(true);
		expect(uiDesignRules()).toContain(fragment);
	}
});
