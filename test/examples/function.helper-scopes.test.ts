import ts from 'typescript';
import { test } from 'vitest';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';
import { helperScopes } from '../../src/utils/development-tooling/helperScopes';

const CHAIN_SOURCE = `
function buildReport() {
	const formatRow = (row: string) => formatDate(row);
	return [1].map(function label() {
		return formatDate('x');
	});
}
const top = formatDate('y');
`;

const SHADOW_SOURCE = `
function renderTitle(formatDate: (value: string) => string) {
	return formatDate('title');
}
function renderBody() {
	const formatDate = (value: string) => value;
	return [formatDate('body')];
}
function renderFooter() {
	for (const formatDate of [1]) {
		formatDate('footer');
	}
}
`;

const FILE_LEVEL_SOURCE = `
const formatDate = (value: string) => value;
function renderLine() {
	return formatDate('line');
}
`;

function meta(state: string) {
	return {
		unitId: 'function.helper-scopes',
		symbol: 'helperScopes',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function parse(source: string): ts.SourceFile {
	return ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true);
}

function isCallee(node: ts.Node, name: string): boolean {
	return (
		ts.isIdentifier(node) &&
		node.text === name &&
		ts.isCallExpression(node.parent) &&
		node.parent.expression === node
	);
}

function callSites(node: ts.Node, name: string): ts.Node[] {
	const found: ts.Node[] = [];
	if (isCallee(node, name)) found.push(node);
	ts.forEachChild(node, (child) => {
		found.push(...callSites(child, name));
	});
	return found;
}

function scopesFor(source: string, name: string) {
	return callSites(parse(source), name).map((node) => helperScopes(node, name));
}

test('Names the enclosing function chain outermost first', () => {
	const scopes = scopesFor(CHAIN_SOURCE, 'formatDate');
	expect(scopes).toEqual([
		{ caller: 'buildReport.formatRow', shadowed: false },
		{ caller: 'buildReport.label', shadowed: false },
		{ caller: null, shadowed: false }
	]);
	recordExampleCases(meta('names-the-enclosing-function-chain-outermost-first'), [
		{
			name: 'call inside an arrow initialised as formatRow in buildReport',
			input: { helper: 'formatDate', site: 'formatRow arrow body' },
			output: scopes[0]
		},
		{
			name: 'call inside a named function expression passed to map',
			input: { helper: 'formatDate', site: 'label function expression' },
			output: scopes[1]
		},
		{
			name: 'call at file level outside any function',
			input: { helper: 'formatDate', site: 'top-level const initialiser' },
			output: scopes[2]
		}
	]);
});

test('Reports a shadowing parameter or block binding', () => {
	const scopes = scopesFor(SHADOW_SOURCE, 'formatDate');
	expect(scopes).toEqual([
		{ caller: 'renderTitle', shadowed: true },
		{ caller: 'renderBody', shadowed: true },
		{ caller: 'renderFooter', shadowed: true }
	]);
	recordExampleCases(meta('reports-a-shadowing-parameter-or-block-binding'), [
		{
			name: 'parameter named formatDate hides the helper',
			input: { helper: 'formatDate', site: 'renderTitle parameter' },
			output: scopes[0]
		},
		{
			name: 'const declared directly in the enclosing block hides the helper',
			input: { helper: 'formatDate', site: 'renderBody block const' },
			output: scopes[1]
		},
		{
			name: 'for-of loop variable hides the helper and still reports the caller',
			input: { helper: 'formatDate', site: 'renderFooter for-of variable' },
			output: scopes[2]
		}
	]);
});

test('Ignores file-level bindings for the helper name', () => {
	const scopes = scopesFor(FILE_LEVEL_SOURCE, 'formatDate');
	expect(scopes).toEqual([{ caller: 'renderLine', shadowed: false }]);
	recordExampleCases(meta('ignores-file-level-bindings-for-the-helper-name'), [
		{
			name: 'top-level const formatDate is not counted as shadowing',
			input: { helper: 'formatDate', site: 'renderLine call' },
			output: scopes[0]
		}
	]);
});

test('Returns no caller for a detached node', () => {
	const detached = ts.factory.createIdentifier('formatDate');
	const result = helperScopes(detached, 'formatDate');
	expect(result).toEqual({ caller: null, shadowed: false });
	recordExampleCases(meta('returns-no-caller-for-a-detached-node'), [
		{
			name: 'identifier created without a parent chain',
			input: { helper: 'formatDate', node: 'detached identifier' },
			output: result
		}
	]);
});
