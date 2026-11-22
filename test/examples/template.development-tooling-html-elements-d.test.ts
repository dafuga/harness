import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	elementName,
	atomTag,
	nativeAtomSource
} from '../../src/templates/development-tooling/htmlElements.js';

test('Returns a name for HTML and SVG tags', () => {
	const inputs = ['div', 'input', 'path'];
	const cases = inputs.map((tag) => ({
		name: `tag ${tag}`,
		input: { tag },
		output: elementName(tag)
	}));
	expect(cases.every((entry) => typeof entry.output === 'string')).toBe(true);
	recordExampleCases(
		{
			unitId: 'template.development-tooling-html-elements-d',
			symbol: 'elementName',
			state: 'returns-a-name-for-html-and-svg-tags',
			evidence: 'examples-cases',
			file: 'returns-a-name-for-html-and-svg-tags.json'
		},
		cases
	);
});

test('Resolves native atom tags by name', () => {
	const inputs = [{ name: 'email' }, { name: 'submit' }];
	const cases = inputs.map((atom) => ({
		name: `atom ${atom.name}`,
		input: { atom },
		output: atomTag(atom)
	}));
	expect(cases.every((entry) => typeof entry.output === 'string')).toBe(true);
	recordExampleCases(
		{
			unitId: 'template.development-tooling-html-elements-d',
			symbol: 'atomTag',
			state: 'resolves-native-atom-tags-by-name',
			evidence: 'examples-cases',
			file: 'resolves-native-atom-tags-by-name.json'
		},
		cases
	);
});

test('Builds native atom source with and without a type', () => {
	const inputs = [{ tag: 'input', type: 'email' }, { tag: 'button' }];
	const cases = inputs.map((atom) => ({
		name: atom.type ? `${atom.tag} type ${atom.type}` : atom.tag,
		input: { atom },
		output: nativeAtomSource(atom)
	}));
	expect(cases.every((entry) => typeof entry.output === 'string')).toBe(true);
	recordExampleCases(
		{
			unitId: 'template.development-tooling-html-elements-d',
			symbol: 'nativeAtomSource',
			state: 'builds-native-atom-source-with-and-without-a-type',
			evidence: 'examples-cases',
			file: 'builds-native-atom-source-with-and-without-a-type.json'
		},
		cases
	);
});
