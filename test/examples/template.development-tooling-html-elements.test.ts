import type { Atom } from './template.development-tooling-html-elements.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	atomTag,
	elementName,
	htmlElements,
	inputTypes,
	nativeAtomSource,
	nativeAtoms,
	svgElements
} from '../../src/templates/development-tooling/htmlElements';

const NULL_TAG = null as unknown as string;
const NULL_ATOM = null as unknown as Atom;

function meta(symbol: string, state: string) {
	return {
		unitId: 'template.development-tooling-html-elements',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function errorOf(call: () => unknown): unknown {
	try {
		call();
	} catch (caught) {
		return caught;
	}
	return undefined;
}

function describeError(error: unknown): { name: string; message: string } {
	const { name, message } = error as Error;
	return { name, message };
}

test('Lists the conforming HTML, SVG and input type names', () => {
	expect(htmlElements).toContain('a');
	expect(htmlElements).toContain('selectedcontent');
	expect(svgElements).toContain('textPath');
	expect(inputTypes).toContain('datetime-local');
	expect(htmlElements.every((tag) => tag === tag.toLowerCase())).toBe(true);
	recordExampleCases(
		meta('htmlElements', 'lists-the-conforming-html-svg-and-input-type-names'),
		[
			{
				name: 'HTML element list starts at a and ends at wbr',
				input: { list: 'htmlElements' },
				output: {
					first: htmlElements[0],
					last: htmlElements[htmlElements.length - 1],
					count: htmlElements.length
				}
			},
			{
				name: 'SVG list keeps camelCase names such as textPath',
				input: { list: 'svgElements' },
				output: { includes: 'textPath', count: svgElements.length }
			},
			{
				name: 'input type list keeps hyphenated names such as datetime-local',
				input: { list: 'inputTypes' },
				output: { includes: 'datetime-local', count: inputTypes.length }
			}
		]
	);
});

test('Maps tag names to Html component names', () => {
	expect(elementName('a')).toBe('HtmlA');
	expect(elementName('h1')).toBe('HtmlH1');
	expect(elementName('input-text')).toBe('HtmlInputText');
	const error = errorOf(() => elementName(NULL_TAG));
	expect(error).toBeInstanceOf(TypeError);
	recordExampleCases(
		meta('elementName', 'maps-tag-names-to-html-component-names'),
		[
			{ name: 'single letter tag gets an Html prefix', input: { tag: 'a' }, output: 'HtmlA' },
			{ name: 'digits in a heading tag are kept', input: { tag: 'h1' }, output: 'HtmlH1' },
			{
				name: 'hyphen-separated words are PascalCased',
				input: { tag: 'input-text' },
				output: 'HtmlInputText'
			},
			{ name: 'null tag throws a TypeError', input: { tag: null }, error: describeError(error) }
		]
	);
});

test('Derives hx- tag names from native atoms', () => {
	const div: Atom = { name: 'HtmlDiv', tag: 'div' };
	const svg: Atom = { name: 'SvgSvg', tag: 'svg' };
	const text: Atom = { name: 'HtmlInputText', tag: 'input', type: 'text' };
	expect(atomTag(div)).toBe('hx-div');
	expect(atomTag(svg)).toBe('hx-svg');
	expect(atomTag(text)).toBe('hx-input-text');
	const error = errorOf(() => atomTag(NULL_ATOM));
	expect(error).toBeInstanceOf(TypeError);
	recordExampleCases(
		meta('atomTag', 'derives-hx-tag-names-from-native-atoms'),
		[
			{ name: 'HtmlDiv maps to hx-div', input: { name: 'HtmlDiv' }, output: 'hx-div' },
			{ name: 'SvgSvg maps to hx-svg', input: { name: 'SvgSvg' }, output: 'hx-svg' },
			{
				name: 'HtmlInputText maps to hx-input-text',
				input: { name: 'HtmlInputText', type: 'text' },
				output: 'hx-input-text'
			},
			{ name: 'null atom throws a TypeError', input: { atom: null }, error: describeError(error) }
		]
	);
});

test('Writes Svelte source for a void input atom', () => {
	const atom: Atom = { name: 'HtmlInputText', tag: 'input', type: 'text' };
	const source = nativeAtomSource(atom);
	expect(source).toContain('<!-- @harness-element input text -->');
	expect(source).toContain('<svelte:element this={\'input\'} {...attributes} type="text">');
	expect(source).not.toContain('{#if children}');
	expect(source).not.toContain('namespace="svg"');
	recordExampleCases(
		meta('nativeAtomSource', 'writes-svelte-source-for-a-void-input-atom'),
		[
			{
				name: 'input text atom has a type attribute and no children block',
				input: atom,
				output: {
					harnessElement: 'input text',
					element: `<svelte:element this={'input'} {...attributes} type="text">`,
					hasChildrenBlock: false,
					hasSvgNamespace: false
				}
			}
		]
	);
});

test('Writes Svelte source for an SVG atom and rejects null', () => {
	const atom: Atom = { name: 'SvgCircle', tag: 'circle' };
	const source = nativeAtomSource(atom);
	expect(source).toContain('<svelte:options namespace="svg" />');
	expect(source).toContain('<!-- @harness-element circle -->');
	expect(source).toContain('{#if children}{@render children()}{/if}');
	expect(source).not.toContain(' type="');
	const error = errorOf(() => nativeAtomSource(NULL_ATOM));
	expect(error).toBeInstanceOf(TypeError);
	recordExampleCases(
		meta('nativeAtomSource', 'writes-svelte-source-for-an-svg-atom-and-rejects-null'),
		[
			{
				name: 'SvgCircle atom uses the svg namespace and a children block',
				input: atom,
				output: {
					harnessElement: 'circle',
					hasSvgNamespace: true,
					hasChildrenBlock: true,
					hasTypeAttribute: false
				}
			},
			{ name: 'null atom throws a TypeError', input: { atom: null }, error: describeError(error) }
		]
	);
});

test('Builds one atom per native element and input type', () => {
	const expectedCount = htmlElements.length + svgElements.length + inputTypes.length + 1;
	expect(nativeAtoms).toHaveLength(expectedCount);
	expect(nativeAtoms[0]).toEqual({ name: 'HtmlA', tag: 'a' });
	expect(nativeAtoms.find((atom) => atom.name === 'SvgPath')).toEqual({ name: 'SvgPath', tag: 'path' });
	expect(nativeAtoms.find((atom) => atom.name === 'HtmlInputWeek')).toEqual({
		name: 'HtmlInputWeek',
		tag: 'input',
		type: 'week'
	});
	expect(nativeAtoms[expectedCount - 1]).toEqual({ name: 'HtmlElement', tag: 'svelte:element' });
	recordExampleCases(
		meta('nativeAtoms', 'builds-one-atom-per-native-element-and-input-type'),
		[
			{
				name: 'atom list has one entry per HTML, SVG and input type plus svelte:element',
				input: { htmlCount: htmlElements.length, svgCount: svgElements.length },
				output: { count: expectedCount, first: nativeAtoms[0], last: nativeAtoms[expectedCount - 1] }
			},
			{
				name: 'input type atom carries its type field',
				input: { name: 'HtmlInputWeek' },
				output: { name: 'HtmlInputWeek', tag: 'input', type: 'week' }
			}
		]
	);
});
