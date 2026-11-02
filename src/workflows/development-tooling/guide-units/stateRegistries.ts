import ts from 'typescript';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { SourceTree } from '../../../core/development-tooling/sourceTypes';
import type { StateRegistry } from './guideUnits.types';
import { fail } from '../../../core/development-tooling/errors';

/** Read declarations as syntax/data, never by importing executable preview fixtures. */
export async function stateRegistries(
	tree: SourceTree,
	root: string,
	extra: string[] = []
): Promise<StateRegistry[]> {
	const paths = (await tree.list()).map((entry) => entry.path).filter(registryPath);
	const found: StateRegistry[] = [];
	for (const path of paths) found.push(...parseRegistry(await tree.read(path), path));
	for (const path of extra) {
		if (paths.includes(path)) continue;
		let text: string;
		try {
			text = await readFile(resolve(root, path), 'utf8');
		} catch {
			return fail(`Cannot read required-state file "${path}".`);
		}
		found.push(...parseRegistry(text, path, true));
	}
	return found;
}

function registryPath(path: string) {
	return (
		/required-states[^/]*\.json$/i.test(path) ||
		(/^packages\/[^/]+\/(?:tests|test)\/e2e\/support\//.test(path) &&
			/(?:variant|preview|scenario|catalog)[^/]*\.[cm]?[tj]s$/i.test(path))
	);
}

function parseRegistry(text: string, where: string, required = /required-states/i.test(where)) {
	const found: StateRegistry[] = [];
	const add = (entity: string, states: string[]) => {
		if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(entity)) return;
		found.push({
			entity,
			where,
			kind: required ? 'required-states' : 'catalog',
			states: [...new Set(states.map((state) => state || 'default'))]
		});
	};
	if (where.endsWith('.json')) {
		try {
			jsonEntries(JSON.parse(text), add);
		} catch {
			fail(`Cannot read required-state JSON "${where}".`);
		}
	} else {
		const source = ts.createSourceFile(where, text, ts.ScriptTarget.Latest, true);
		visitRegistry(source, add);
	}
	return found;
}

function jsonEntries(data: unknown, add: (entity: string, states: string[]) => void): void {
	if (!data || typeof data !== 'object') return;
	if (Array.isArray(data)) {
		for (const row of data) jsonEntries(row, add);
		return;
	}
	const row = data as Record<string, unknown>;
	jsonRow(row, add);
	for (const [key, item] of Object.entries(row)) {
		if (Array.isArray(item) && item.every((value) => typeof value === 'string')) add(key, item);
		else jsonEntries(item, add);
	}
}

function jsonRow(row: Record<string, unknown>, add: (entity: string, states: string[]) => void) {
	const entity = row.entity ?? row.entityId ?? row.unit ?? row.id;
	if (typeof entity === 'string' && Array.isArray(row.states)) add(entity, jsonStates(row.states));
}

function jsonStates(items: unknown[]): string[] {
	return items.flatMap((item) => {
		if (typeof item === 'string') return [item];
		const id = item && typeof item === 'object' && 'id' in item ? item.id : undefined;
		return typeof id === 'string' ? [id] : [];
	});
}

function literal(node: ts.Node | undefined): string | undefined {
	return node && (ts.isStringLiteralLike(node) || ts.isIdentifier(node)) ? node.text : undefined;
}

function arrayStates(node: ts.Expression): string[] | undefined {
	if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node))
		return arrayStates(node.expression);
	if (!ts.isArrayLiteralExpression(node)) return undefined;
	const items = node.elements.map((item) => (ts.isStringLiteralLike(item) ? item.text : undefined));
	return items.every((item) => item !== undefined) ? items : undefined;
}

function visitRegistry(node: ts.Node, add: (entity: string, states: string[]) => void): void {
	if (ts.isObjectLiteralExpression(node)) {
		const props = node.properties.filter(ts.isPropertyAssignment);
		const fields = new Map(props.map((prop) => [literal(prop.name), prop.initializer]));
		const owner = ['entity', 'entityId', 'unit', 'id']
			.map((key) => literal(fields.get(key)))
			.find(Boolean);
		const states = fields.get('states') ?? fields.get('variants');
		if (owner && states) add(owner, arrayStates(states) ?? []);
		for (const prop of props) {
			const key = literal(prop.name);
			const list = arrayStates(prop.initializer);
			if (key && list) add(key, list);
		}
	}
	ts.forEachChild(node, (child) => visitRegistry(child, add));
}
