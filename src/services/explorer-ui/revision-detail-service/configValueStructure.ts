import ts from 'typescript';
import type { ConfigValueNode } from '../../../utils/explorer-ui/unitMetadata';

type Bindings = Map<string, ts.Expression>;
type CollectionNode = Extract<ConfigValueNode, { kind: 'object' | 'array' }>;
const shapePreserving = new Set([
	'optional',
	'nullable',
	'nullish',
	'default',
	'catch',
	'readonly',
	'refine',
	'superRefine',
	'describe',
	'brand',
	'partial',
	'required',
	'strict',
	'strip'
]);

/** Inspect committed syntax only; opaque calls, unknown lengths and recursive aliases stay explicit. */
export function configValueStructure(
	value: ts.Expression,
	bindings: Bindings,
	depth = 0
): ConfigValueNode {
	const source = value.getText();
	if (depth >= 10) return { kind: 'expression', source };
	const resolved = resolve(value, bindings);
	if (ts.isObjectLiteralExpression(resolved)) return objectNode(resolved, source, bindings, depth);
	if (ts.isArrayLiteralExpression(resolved)) return arrayNode(resolved, source, bindings, depth);
	return schemaNode(resolved, source, bindings, depth);
}

function schemaNode(
	value: ts.Expression,
	source: string,
	bindings: Bindings,
	depth: number
): ConfigValueNode {
	const constructor = schemaConstructor(value, bindings);
	if (!ts.isCallExpression(constructor)) return { kind: 'expression', source };
	const call = schemaConstructorName(constructor.expression);
	const first = constructor.arguments[0];
	if (['object', 'strictObject', 'looseObject'].includes(call) && first) {
		const shape = resolve(first, bindings);
		if (ts.isObjectLiteralExpression(shape))
			return { ...objectNode(shape, source, bindings, depth), schema: true };
	}
	if (call === 'array' && first)
		return {
			kind: 'array',
			source,
			schema: true,
			entries: [{ name: 'Item schema', node: configValueStructure(first, bindings, depth + 1) }]
		};
	return { kind: 'expression', source };
}

/** Property access is recognized from syntax, independent of line breaks and comments. */
function schemaConstructorName(callee: ts.Expression): string {
	if (!ts.isPropertyAccessExpression(callee)) return '';
	if (!ts.isIdentifier(callee.expression) || callee.expression.text !== 'z') return '';
	return callee.name.text;
}

function asserted(
	node: ts.Expression
): node is
	| ts.ParenthesizedExpression
	| ts.AsExpression
	| ts.TypeAssertion
	| ts.SatisfiesExpression {
	return (
		ts.isParenthesizedExpression(node) ||
		ts.isAsExpression(node) ||
		ts.isTypeAssertionExpression(node) ||
		ts.isSatisfiesExpression(node)
	);
}

function resolve(value: ts.Expression, bindings: Bindings): ts.Expression {
	const seen = new Set<string>();
	let node = value;
	for (let count = 0; count < 50; count++) {
		if (asserted(node)) {
			node = node.expression;
			continue;
		}
		if (ts.isIdentifier(node) && bindings.has(node.text) && !seen.has(node.text)) {
			seen.add(node.text);
			node = bindings.get(node.text)!;
			continue;
		}
		break;
	}
	return node;
}

/** Only inspect the declared shape of known schema constructors through preserving wrappers. */
function schemaConstructor(value: ts.Expression, bindings: Bindings): ts.Expression {
	let node = value;
	while (
		ts.isCallExpression(node) &&
		ts.isPropertyAccessExpression(node.expression) &&
		shapePreserving.has(node.expression.name.text)
	) {
		node = resolve(node.expression.expression, bindings);
	}
	return node;
}

function propertyName(property: ts.ObjectLiteralElementLike): string | undefined {
	if (ts.isSpreadAssignment(property)) return undefined;
	const name = property.name;
	if (!name) return undefined;
	if (ts.isComputedPropertyName(name))
		return ts.isStringLiteralLike(name.expression) || ts.isNumericLiteral(name.expression)
			? name.expression.text
			: undefined;
	return ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)
		? name.text
		: undefined;
}

function propertyValue(property: ts.ObjectLiteralElementLike): ts.Expression | undefined {
	if (ts.isPropertyAssignment(property)) return property.initializer;
	if (ts.isShorthandPropertyAssignment(property)) return property.name;
	return undefined;
}

function objectNode(
	object: ts.ObjectLiteralExpression,
	source: string,
	bindings: Bindings,
	depth: number
): CollectionNode {
	const names = object.properties.map(propertyName);
	const known = names.every((name) => name !== undefined);
	const entries = object.properties.map((property, index) => {
		const value = propertyValue(property);
		return {
			name: names[index] ?? property.getText(),
			node: value
				? configValueStructure(value, bindings, depth + 1)
				: { kind: 'expression' as const, source: property.getText() }
		};
	});
	return { kind: 'object', source, entries, ...(known ? { count: new Set(names).size } : {}) };
}

function arrayNode(
	array: ts.ArrayLiteralExpression,
	source: string,
	bindings: Bindings,
	depth: number
): ConfigValueNode {
	return {
		kind: 'array',
		source,
		...(array.elements.some(ts.isSpreadElement) ? {} : { count: array.elements.length }),
		entries: array.elements.map((value, index) => ({
			name: String(index),
			node: configValueStructure(value, bindings, depth + 1)
		}))
	};
}
