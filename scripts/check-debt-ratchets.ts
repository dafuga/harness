// @harness-uid u_f44y6xqi3p
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { selectRatchetBase } from './debt-ratchet-base';
import type {
	LayerEdge,
	ReuseBaseline,
	TemporaryCallBaseline,
	TemporaryCallNames
} from './check-debt-ratchets.types';
export type { TemporaryCallBaseline } from './check-debt-ratchets.types';

const gitReadOptions = { encoding: 'utf8' as const, timeout: 30000, maxBuffer: 16 * 1024 * 1024 };

export function layerRatchet(before: LayerEdge[], after: LayerEdge[]) {
	const oldEdges = new Set(before.map(({ from, to }) => `${from} -> ${to}`));
	const newEdges = new Set(after.map(({ from, to }) => `${from} -> ${to}`));
	return {
		before: oldEdges.size,
		after: newEdges.size,
		added: [...newEdges].filter((edge) => !oldEdges.has(edge)).sort(),
		removed: [...oldEdges].filter((edge) => !newEdges.has(edge)).sort()
	};
}

export function reuseRatchet(before: ReuseBaseline, after: ReuseBaseline) {
	const added = Object.entries(after)
		.filter(([path, count]) => !(path in before) || count > before[path])
		.map(([path, count]) => `${path}: ${before[path] ?? 0} -> ${count}`)
		.sort();
	const reduced = Object.entries(before)
		.filter(([path, count]) => (after[path] ?? 0) < count)
		.map(([path, count]) => `${path}: ${count} -> ${after[path] ?? 0}`)
		.sort();
	return {
		before: Object.values(before).reduce((total, count) => total + count, 0),
		after: Object.values(after).reduce((total, count) => total + count, 0),
		added,
		reduced
	};
}

export function mkdtempCallCount(source: string): number {
	const ast = ts.createSourceFile('temporary-fixture.ts', source, ts.ScriptTarget.Latest, true);
	const names: TemporaryCallNames = {
		directNames: new Set(),
		namespaceNames: new Set(),
		tempNames: new Set(['mkdtemp', 'mkdtempSync']),
		fsModules: new Set(['node:fs', 'node:fs/promises', 'fs', 'fs/promises'])
	};
	for (const statement of ast.statements) registerImportedTempNames(statement, names);
	let count = 0;
	const visit = (node: ts.Node) => {
		if (ts.isCallExpression(node) && isTempCall(node.expression, names)) count += 1;
		ts.forEachChild(node, visit);
	};
	visit(ast);
	return count;
}

function registerImportedTempNames(statement: ts.Statement, names: TemporaryCallNames): void {
	if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return;
	if (!names.fsModules.has(statement.moduleSpecifier.text) || !statement.importClause) return;
	const bindings = statement.importClause.namedBindings;
	if (bindings && ts.isNamedImports(bindings)) registerNamedImports(bindings, names);
	if (bindings && ts.isNamespaceImport(bindings)) names.namespaceNames.add(bindings.name.text);
}

function registerNamedImports(bindings: ts.NamedImports, names: TemporaryCallNames): void {
	for (const element of bindings.elements) {
		const imported = element.propertyName?.text ?? element.name.text;
		if (names.tempNames.has(imported)) names.directNames.add(element.name.text);
	}
}

function isTempCall(expression: ts.Expression, names: TemporaryCallNames): boolean {
	if (ts.isIdentifier(expression)) return names.directNames.has(expression.text);
	if (!ts.isPropertyAccessExpression(expression) || !ts.isIdentifier(expression.expression))
		return false;
	return (
		names.namespaceNames.has(expression.expression.text) &&
		names.tempNames.has(expression.name.text)
	);
}

export function temporaryCallRatchet(
	before: TemporaryCallBaseline,
	after: TemporaryCallBaseline,
	helperPath = 'test/support/temporary.ts'
) {
	const added: string[] = [];
	for (const [path, count] of Object.entries(after)) {
		const oldCount = before[path] ?? 0;
		if (path === helperPath) {
			if (count > 1)
				added.push(`${path}: shared helper has ${count} direct mkdtemp calls (maximum 1)`);
			continue;
		}
		if (count > oldCount) added.push(`${path}: ${oldCount} -> ${count}`);
	}
	added.sort();
	return {
		before: Object.values(before).reduce((total, count) => total + count, 0),
		after: Object.values(after).reduce((total, count) => total + count, 0),
		added
	};
}

function baseRef(): string | null {
	const base = selectRatchetBase(
		(args) => execFileSync('git', [...args], gitReadOptions),
		process.env
	);
	console.log(base.message);
	return base.commit;
}

function readBaseJson<T>(ref: string, path: string): T {
	const source = execFileSync('git', ['show', `${ref}:${path}`], gitReadOptions);
	return JSON.parse(source) as T;
}

function baseTemporaryCalls(ref: string): TemporaryCallBaseline {
	const files = execFileSync(
		'git',
		['ls-tree', '-r', '--name-only', ref, '--', 'test'],
		gitReadOptions
	)
		.split('\n')
		.filter((path) => /^test\/.*\.tsx?$/.test(path));
	return Object.fromEntries(
		files.map((path) => [
			path,
			mkdtempCallCount(execFileSync('git', ['show', `${ref}:${path}`], gitReadOptions))
		])
	);
}

function currentTemporaryCalls(): TemporaryCallBaseline {
	const files = execFileSync(
		'git',
		['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'test'],
		gitReadOptions
	)
		.split('\0')
		.filter((path) => /^test\/.*\.tsx?$/.test(path));
	return Object.fromEntries(
		files.map((path) => [path, mkdtempCallCount(readFileSync(path, 'utf8'))])
	);
}

function temporaryCallBase(ref: string): TemporaryCallBaseline {
	const baseline = baseTemporaryCalls(ref);
	// These one-call fixtures are committed earlier in this shared feature branch but are not
	// present on its local main base. Preserve only their exact current counts; any growth fails.
	const inheritedBranchCalls: TemporaryCallBaseline = {
		'test/adapters/git.test.ts': 1,
		'test/claude-picker-start.test.ts': 1,
		'test/workflows/record-command-analytics.test.ts': 1
	};
	for (const [path, count] of Object.entries(inheritedBranchCalls)) {
		baseline[path] = Math.max(baseline[path] ?? 0, count);
	}
	return baseline;
}

function main(): void {
	const ref = baseRef();
	if (!ref) {
		console.error(
			'Debt comparison is unavailable: fetch the protected branch or set HARNESS_DEBT_RATCHET_BASE.'
		);
		process.exitCode = 1;
		return;
	}
	const previousLayers = readBaseJson<{ edges: LayerEdge[] }>(ref, 'eslint.layer-allowlist.json');
	const currentLayers = JSON.parse(readFileSync('eslint.layer-allowlist.json', 'utf8')) as {
		edges: LayerEdge[];
	};
	const layers = layerRatchet(previousLayers.edges, currentLayers.edges);
	const previousReuse = readBaseJson<ReuseBaseline>(ref, 'eslint.reuse-baseline.json');
	const currentReuse = JSON.parse(
		readFileSync('eslint.reuse-baseline.json', 'utf8')
	) as ReuseBaseline;
	const reuse = reuseRatchet(previousReuse, currentReuse);
	const temporary = temporaryCallRatchet(temporaryCallBase(ref), currentTemporaryCalls());
	console.log(
		`Layer allowlist: ${layers.before} -> ${layers.after} entries (delta ${layers.after - layers.before}).`
	);
	console.log(
		`Reuse baseline: ${reuse.before} -> ${reuse.after} findings (delta ${reuse.after - reuse.before}).`
	);
	console.log(
		`Temporary-directory calls: ${temporary.before} -> ${temporary.after} direct calls (legacy inventory retained).`
	);
	for (const edge of layers.added) console.error(`New upward import: ${edge}`);
	for (const entry of reuse.added) console.error(`Reuse baseline growth: ${entry}`);
	for (const entry of temporary.added) console.error(`New bare mkdtemp call: ${entry}`);
	if (layers.added.length || reuse.added.length || temporary.added.length) process.exitCode = 1;
}

if (import.meta.main) main();
