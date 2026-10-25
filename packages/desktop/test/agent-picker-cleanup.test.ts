import type { AstNode, Unit } from './agent-picker-cleanup.test.types';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parse, parseCss, type AST } from 'svelte/compiler';
import { test } from 'vitest';
import { expect } from '../../../test/verificationExpect';
import { scanImports } from '../../../src/services/source-index-service/scanImports';
const desktop = resolve(import.meta.dirname, '..');
const root = resolve(desktop, '../..');
const src = join(desktop, 'src');
const ownFile = join(desktop, 'test', 'agent-picker-cleanup.test.ts');
const alias = /\$shared:\s*'([^']+)'/.exec(read('svelte.config.js'))?.[1] ?? '';
const shared = resolve(desktop, alias);
const component = (name: string) => join(src, 'components', `${name}.svelte`);
const pickers = ['AgentModelPicker', 'AgentEffortPicker'].map(component);
const packagesDir = join(root, 'packages');
const packageDirs = readdirSync(packagesDir).map((name) => join(packagesDir, name));
const hubView = 'packages/reports/src/components/HubView.svelte';
const retiredPath = hubView.slice('packages/'.length);
const none = { dialog: 0, showModal: 0, escape: 0, backdrop: 0 };
const trees = new Map<string, AST.Root>();

function read(path: string): string {
	return readFileSync(resolve(desktop, path), 'utf8');
}
function tree(file: string): AST.Root {
	const found = trees.get(file) ?? parse(read(file), { modern: true });
	trees.set(file, found);
	return found;
}
const rel = (path: string) => relative(root, path);
function files(dir: string, kind: RegExp): string[] {
	if (!existsSync(dir)) return [];
	const found = readdirSync(dir, { recursive: true, encoding: 'utf8' });
	return found.filter((path) => kind.test(path)).map((path) => join(dir, path));
}
/** Every node of a Svelte, CSS or script syntax tree. */
function nodes(value: unknown, found: AstNode[] = [], seen = new Set<unknown>()): AstNode[] {
	if (!value || typeof value !== 'object' || seen.has(value)) return found;
	seen.add(value);
	if (typeof (value as AstNode).type === 'string') found.push(value as AstNode);
	for (const item of Object.values(value)) nodes(item, found, seen);
	return found;
}
/** What a modal picker does: its dialog, opening it, closing on Escape and its backdrop. */
function lifecycle(file: string) {
	const all = nodes(tree(file));
	const count = (matches: (node: AstNode) => boolean) => all.filter(matches).length;
	const called = (node: AstNode) => (node.callee as { property?: AstNode })?.property?.name;
	const escape = (node: AstNode) =>
		(node.type === 'Literal' && node.value === 'Escape') ||
		(node.type === 'Attribute' && node.name === 'oncancel');
	return {
		dialog: count(
			(node) =>
				node.type === 'RegularElement' && ['dialog', 'hx-dialog'].includes(String(node.name))
		),
		showModal: count((node) => node.type === 'CallExpression' && called(node) === 'showModal'),
		escape: count(escape),
		backdrop: count((node) => node.type === 'PseudoElementSelector' && node.name === 'backdrop')
	};
}
/** The Svelte modules a component reaches through the imports it writes, aliases resolved. */
function reached(file: string, seen = new Set<string>()): Set<string> {
	for (const { specifier } of scanImports(read(file), 'svelte')) {
		if (!specifier?.endsWith('.svelte')) continue;
		const local = specifier.startsWith('.') ? resolve(dirname(file), specifier) : null;
		const next = specifier.startsWith('$shared/') ? join(shared, specifier.slice(8)) : local;
		if (next && !seen.has(next)) reached(next, seen.add(next));
	}
	return seen;
}
/** The modules both pickers reach that hold a dialog and open it modally. */
function owners(): string[] {
	const [model, effort] = pickers.map((file) => reached(file));
	const owns = (file: string) => lifecycle(file).dialog > 0 && lifecycle(file).showModal > 0;
	return [...model].filter((file) => effort.has(file) && owns(file));
}
function opens(file: string): boolean {
	return read(file).includes('showModal') && lifecycle(file).showModal > 0;
}

test('both pickers reach one shared dialog that alone owns the modal lifecycle', () => {
	const own = pickers.map((file) => [rel(file), lifecycle(file)]);
	expect(own).toEqual(pickers.map((file) => [rel(file), none]));
	const found = owners();
	expect(found.map(rel)).toHaveLength(1);
	const shape = lifecycle(found[0]);
	expect(shape).toMatchObject({ dialog: 1, showModal: 1 });
	expect(Math.min(shape.escape, shape.backdrop)).toBeGreaterThan(0);
});

test('the picker import graph opens a modal dialog through its shared owner only', () => {
	const graph = [...new Set(pickers.flatMap((file) => [file, ...reached(file)]))];
	const opening = graph.filter(opens);
	const own = owners();
	expect(opening.map(rel)).toEqual(own.map(rel));
});

/** Classes a stylesheet styles together with the composer row, in one compound selector. */
function rowClasses(sheet: unknown): string[] {
	const compounds = nodes(sheet).filter((node) => node.type === 'RelativeSelector');
	return compounds.flatMap((node) => {
		const names = (node.selectors as AstNode[])
			.filter((item) => item.type === 'ClassSelector')
			.map((item) => String(item.name));
		const row = names.includes('composer-bottom');
		return row ? names.filter((name) => name !== 'composer-bottom') : [];
	});
}
/** The class names a text, a string or a template piece of a class attribute writes. */
function words(node: AstNode): string[] {
	const cooked = (node.value as { cooked?: unknown } | null)?.cooked;
	const by: AstNode = { Text: node.data, Literal: node.value, TemplateElement: cooked };
	const text = by[String(node.type)];
	return typeof text === 'string' ? text.split(/\s+/).filter(Boolean) : [];
}
/** Classes markup applies: class attributes, on elements and components, and class: directives. */
function appliedClasses(file: string): string[] {
	return nodes(tree(file).fragment).flatMap((node) => {
		if (node.type === 'ClassDirective') return [String(node.name)];
		const named = node.type === 'Attribute' && node.name === 'class';
		return named ? nodes(node.value).flatMap(words) : [];
	});
}

test('every class the composer row is styled with is applied by some markup', () => {
	const components = files(src, /\.svelte$/);
	const sheets = [
		...files(src, /\.css$/).map((file) => parseCss(read(file))),
		...components.map((file) => tree(file).css)
	];
	const styled = [...new Set(sheets.flatMap(rowClasses))];
	const applied = new Set(components.flatMap(appliedClasses));
	expect(styled).toContain('agent-icons');
	expect(styled.filter((name) => !applied.has(name)).sort()).toEqual([]);
});

test('the retired HubView keeps its history as a retired manifest, not as active source', () => {
	const unitFiles = files(join(root, 'specification/units'), /\.json$/);
	const units = unitFiles.map((file) => JSON.parse(read(file)) as Unit);
	expect(existsSync(join(root, hubView))).toBe(false);
	expect(units.find((unit) => unit.id === 'reports.component.hub-view')).toMatchObject({
		status: 'retired',
		owns: { source: [hubView] },
		retired: {
			reason: expect.stringMatching(/\S/),
			at: expect.stringMatching(/^\d{4}-\d\d-\d\dT/)
		}
	});
	const owning = units.filter((unit) => unit.owns.source.includes(hubView));
	expect(owning.filter((unit) => unit.status === 'active').map((unit) => unit.id)).toEqual([]);
});

/** Whether a source file writes an import of HubView, under any path or alias. */
function importsHubView(file: string): boolean {
	if (rel(file) === hubView || !read(file).includes('HubView')) return false;
	const language = file.endsWith('.svelte') ? 'svelte' : 'ts';
	const named = /(^|\/)HubView(\.svelte)?$/;
	return scanImports(read(file), language).some(({ specifier }) => named.test(specifier ?? ''));
}

test('nothing in any package imports, mounts or exports HubView', () => {
	const sources = packageDirs.flatMap((dir) => files(join(dir, 'src'), /\.(svelte|ts|js)$/));
	expect(sources.filter(importsHubView).map(rel)).toEqual([]);
	const manifests = packageDirs.map((dir) => join(dir, 'package.json')).filter(existsSync);
	expect(manifests.filter((file) => read(file).includes('HubView')).map(rel)).toEqual([]);
});

test('no test or verification scope still compiles the retired view', () => {
	const homes = [root, ...packageDirs];
	const dirs = homes.flatMap((dir) => [join(dir, 'test'), join(dir, 'tests')]);
	const scripts = dirs.flatMap((dir) => files(dir, /\.ts$/));
	const naming = scripts.filter((file) => file !== ownFile && read(file).includes(retiredPath));
	expect(naming.map(rel)).toEqual([]);
});

test('retiring HubView changes no legacy redirect', () => {
	const routes = join(root, 'packages/reports/src/routes');
	const redirects = files(routes, /\+page\.server\.ts$/).flatMap((file) => {
		const found = /\bredirect\(([^;]*)\);/.exec(read(file));
		return found ? [[relative(routes, file), found[1]]] : [];
	});
	expect(Object.fromEntries(redirects)).toEqual({
		'+page.server.ts': "308, '/harness'",
		'analytics/+page.server.ts': "308, '/harness'",
		'reports/[id]/+page.server.ts': "308, '/harness/reports/' + encodeURIComponent(params.id)",
		'harness/analytics/+page.server.ts': "308, '/harness'",
		'harness/reports/+page.server.ts': "308, '/harness'",
		'harness/reports/[id]/+page.server.ts':
			"307, '/harness' + reportDestination(index, report ?? { id: params.id })",
		'harness/[...view]/+page.server.ts': '308, target'
	});
});
