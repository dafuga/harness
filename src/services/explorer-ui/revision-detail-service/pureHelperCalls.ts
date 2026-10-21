import ts from 'typescript';
export const pureGlobals = new Set([
	'String',
	'Number',
	'Boolean',
	'parseInt',
	'parseFloat',
	'encodeURIComponent',
	'decodeURIComponent',
	'isFinite',
	'isNaN'
]);
const methods = new Set([
	'trim',
	'trimStart',
	'trimEnd',
	'toLowerCase',
	'toUpperCase',
	'charAt',
	'split',
	'replace',
	'replaceAll',
	'slice',
	'substring',
	'startsWith',
	'endsWith',
	'includes',
	'concat',
	'at',
	'padStart',
	'padEnd',
	'normalize',
	'toFixed',
	'toString',
	'match',
	'join',
	'map',
	'flatMap',
	'filter',
	'reduce',
	'some',
	'every',
	'find',
	'findIndex',
	'indexOf',
	'lastIndexOf',
	'toISOString',
	'getTime',
	'getUTCFullYear',
	'getUTCMonth',
	'getUTCDate'
]);
const maths = new Set([
	'abs',
	'ceil',
	'floor',
	'round',
	'min',
	'max',
	'trunc',
	'log',
	'log2',
	'log10',
	'pow',
	'sqrt',
	'sign'
]);
export function pureHelperCalls(node: ts.CallExpression, local: Set<string>): boolean {
	const call = node.expression;
	if (ts.isIdentifier(call)) return pureGlobals.has(call.text) || local.has(call.text);
	if (!ts.isPropertyAccessExpression(call)) return false;
	const owner = call.expression.getText();
	if (owner === 'Math') return maths.has(call.name.text);
	if (owner === 'JSON') return ['parse', 'stringify'].includes(call.name.text);
	if (owner === 'Number')
		return ['isFinite', 'isNaN', 'isInteger', 'isSafeInteger'].includes(call.name.text);
	if (owner === 'Array') return ['isArray', 'from'].includes(call.name.text);
	if (owner === 'Object') return ['keys', 'values', 'entries', 'is'].includes(call.name.text);
	return methods.has(call.name.text);
}
