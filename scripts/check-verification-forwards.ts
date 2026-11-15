// @harness-uid u_4pduzolhj3
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import type {
	ExportResolution,
	ForwardCheckContext,
	ForwardEntry,
	ForwardRegistry,
	ForwardResolutionContext
} from './check-verification-forwards.types';

const registryPath = 'scripts/verification-forward-registry.json';
const compatibilityRoots = [
	'src/workflows/run-verify',
	'src/utils/verification-evidence/verifyPlan.ts'
];

/** Confirms deprecated forwards still resolve to their real targets and keep registered IDs. */
export function checkVerificationForwards(root: string): string[] {
	const loaded = readForwardEntries(root);
	if ('issue' in loaded) return [loaded.issue];
	const discovered = discoveredForwards(root);
	const context = createCheckContext(root, loaded.entries, discovered);
	const issues: string[] = [];
	for (const entry of loaded.entries) {
		if (context.registered.has(entry.path))
			issues.push(`${entry.path} is registered more than once`);
		context.registered.set(entry.path, entry);
		issues.push(...inspectEntry(entry, context));
	}
	for (const path of discovered) {
		if (!context.registered.has(path))
			issues.push(`${path} is a compatibility forward missing from ${registryPath}`);
	}
	return issues;
}

function readForwardEntries(root: string): { entries: ForwardEntry[] } | { issue: string } {
	try {
		const registry = JSON.parse(readFileSync(join(root, registryPath), 'utf8')) as ForwardRegistry;
		return registry.schemaVersion === 1 && Array.isArray(registry.forwards)
			? { entries: registry.forwards }
			: { issue: `${registryPath} has an unsupported registry shape` };
	} catch {
		return { issue: `${registryPath} is missing or invalid` };
	}
}

function createCheckContext(
	root: string,
	entries: ForwardEntry[],
	discovered: string[]
): ForwardCheckContext {
	return {
		root,
		registered: new Map(),
		resolution: {
			root,
			canonicalTargets: new Set(entries.map((entry) => entry.target)),
			forwardPaths: new Set([...discovered, ...entries.map((entry) => entry.path)])
		}
	};
}

function inspectEntry(entry: ForwardEntry, context: ForwardCheckContext): string[] {
	const issues = entry.status === 'deprecated' ? [] : [`${entry.path} is not marked deprecated`];
	const sourcePath = join(context.root, entry.path);
	const targetPath = join(context.root, entry.target);
	if (!exists(sourcePath)) return [...issues, `${entry.path} is missing`];
	if (!exists(targetPath))
		return [...issues, `${entry.path} names missing canonical target ${entry.target}`];
	const source = readFileSync(sourcePath, 'utf8');
	if (uidOf(source) !== entry.uid) issues.push(`${entry.path} no longer retains UID ${entry.uid}`);
	if (!isForwardOnlyModule(entry.path, source)) {
		issues.push(
			`${entry.path} contains runtime implementation; deprecated forwards may contain only type declarations and export declarations`
		);
	}
	if (uidOf(readFileSync(targetPath, 'utf8')) !== entry.uid)
		issues.push(`${entry.path} target no longer owns UID ${entry.uid}`);
	const result = resolveExports(entry.path, context.resolution);
	issues.push(
		...result.cycles.map((cycle) => `${entry.path} has cyclic forward ${cycle.join(' -> ')}`)
	);
	if (!result.targets.has(entry.target)) {
		issues.push(
			`${entry.path} resolves to ${[...result.targets].join(', ') || 'no target'}, not ${entry.target}`
		);
	}
	return issues;
}

function resolveExports(
	path: string,
	context: ForwardResolutionContext,
	trail: string[] = []
): ExportResolution {
	if (context.canonicalTargets.has(path)) return { targets: new Set([path]), cycles: [] };
	const cycleAt = trail.indexOf(path);
	if (cycleAt >= 0) return { targets: new Set(), cycles: [[...trail.slice(cycleAt), path]] };
	const source = readFileSync(join(context.root, path), 'utf8');
	if (context.forwardPaths.has(path) && !isForwardOnlyModule(path, source))
		return { targets: new Set([path]), cycles: [] };
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const specifiers = file.statements.flatMap((statement) => {
		if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) return [];
		return ts.isStringLiteral(statement.moduleSpecifier) ? [statement.moduleSpecifier.text] : [];
	});
	if (specifiers.length === 0) return { targets: new Set([path]), cycles: [] };
	return mergeResolutions(specifiers, path, context, [...trail, path]);
}

function mergeResolutions(
	specifiers: string[],
	path: string,
	context: ForwardResolutionContext,
	trail: string[]
): ExportResolution {
	const combined: ExportResolution = { targets: new Set(), cycles: [] };
	for (const specifier of specifiers) {
		if (!specifier.startsWith('.')) continue;
		const target = resolveSourcePath(context.root, resolve(context.root, dirname(path), specifier));
		if (!target) continue;
		const result = resolveExports(target, context, trail);
		for (const finalTarget of result.targets) combined.targets.add(finalTarget);
		combined.cycles.push(...result.cycles);
	}
	return combined;
}

function isForwardOnlyModule(path: string, source: string): boolean {
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	return file.statements.length > 0 && file.statements.every(isForwardStatement);
}

function isForwardStatement(statement: ts.Statement): boolean {
	if (ts.isExportDeclaration(statement)) return isForwardExport(statement);
	if (ts.isImportDeclaration(statement)) return isTypeOnlyImport(statement);
	return (
		(ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
		Boolean(statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
	);
}

function isForwardExport(statement: ts.ExportDeclaration): boolean {
	return statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier);
}

function isTypeOnlyImport(statement: ts.ImportDeclaration): boolean {
	const clause = statement.importClause;
	if (!clause) return false;
	if (clause.isTypeOnly) return true;
	return Boolean(
		!clause.name &&
		clause.namedBindings &&
		ts.isNamedImports(clause.namedBindings) &&
		clause.namedBindings.elements.every((specifier) => specifier.isTypeOnly)
	);
}

function resolveSourcePath(root: string, path: string): string | undefined {
	const candidates = path.endsWith('.ts') ? [path] : [`${path}.ts`, join(path, 'index.ts')];
	const candidate = candidates.find(existsSync);
	return candidate ? relative(root, candidate) : undefined;
}

function discoveredForwards(root: string): string[] {
	return compatibilityRoots.flatMap((candidate) => {
		const path = join(root, candidate);
		if (exists(path)) return isFile(path) ? [candidate] : filesBelow(root, candidate);
		return [];
	});
}

function filesBelow(root: string, directory: string): string[] {
	return safeEntries(join(root, directory)).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return filesBelow(root, path);
		return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
	});
}

function safeEntries(directory: string) {
	try {
		return readdirSync(directory, { withFileTypes: true });
	} catch {
		return [];
	}
}

const uidOf = (source: string) => /@harness-uid\s+(\S+)/.exec(source)?.[1];
const exists = (path: string) => existsSync(path);

function isFile(path: string): boolean {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

if (import.meta.main) {
	const issues = checkVerificationForwards(process.cwd());
	if (issues.length === 0)
		console.log(
			`Verified ${discoveredForwards(process.cwd()).length} deprecated verification forwards.`
		);
	else {
		for (const issue of issues) console.error(issue);
		process.exitCode = 1;
	}
}
