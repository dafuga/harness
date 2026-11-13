// @harness-uid u_4pduzolhj3
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const registryPath = 'scripts/verification-forward-registry.json';
const compatibilityRoots = [
	'src/workflows/run-verify',
	'src/utils/verifyPlan.ts',
	'src/utils/verification-evidence/verifyPlan.ts'
];

/** Confirms deprecated forwards still resolve to their real targets and keep registered IDs. */
export function checkVerificationForwards(root: string): string[] {
	const issues: string[] = [];
	let entries: Array<{ path: string; target: string; uid: string; status: string }>;
	try {
		const registry = JSON.parse(readFileSync(join(root, registryPath), 'utf8')) as {
			schemaVersion?: number;
			forwards?: Array<{ path: string; target: string; uid: string; status: string }>;
		};
		if (registry.schemaVersion !== 1 || !Array.isArray(registry.forwards))
			return [`${registryPath} has an unsupported registry shape`];
		entries = registry.forwards;
	} catch {
		return [`${registryPath} is missing or invalid`];
	}

	const registered = new Map<string, (typeof entries)[number]>();
	for (const entry of entries) {
		if (registered.has(entry.path)) issues.push(`${entry.path} is registered more than once`);
		registered.set(entry.path, entry);
		if (entry.status !== 'deprecated') issues.push(`${entry.path} is not marked deprecated`);
		const sourcePath = join(root, entry.path);
		const targetPath = join(root, entry.target);
		if (!exists(sourcePath)) {
			issues.push(`${entry.path} is missing`);
			continue;
		}
		if (!exists(targetPath)) {
			issues.push(`${entry.path} names missing canonical target ${entry.target}`);
			continue;
		}
		const source = readFileSync(sourcePath, 'utf8');
		const sourceUid = uidOf(source);
		if (sourceUid !== entry.uid) issues.push(`${entry.path} no longer retains UID ${entry.uid}`);
		const targetUid = uidOf(readFileSync(targetPath, 'utf8'));
		if (targetUid !== entry.uid)
			issues.push(`${entry.path} target no longer owns UID ${entry.uid}`);
		const resolved = resolveExports(root, entry.path, new Set());
		if (!resolved.has(entry.target)) {
			issues.push(
				`${entry.path} resolves to ${[...resolved].join(', ') || 'no target'}, not ${entry.target}`
			);
		}
	}

	for (const path of discoveredForwards(root)) {
		if (!registered.has(path))
			issues.push(`${path} is a compatibility forward missing from ${registryPath}`);
	}
	return issues;
}

function resolveExports(root: string, path: string, visited: Set<string>): Set<string> {
	if (visited.has(path)) return new Set();
	visited.add(path);
	const source = readFileSync(join(root, path), 'utf8');
	const specifiers = [
		...source.matchAll(/\bexport\s+(?:\{[\s\S]*?\}|\*)\s+from\s+['"]([^'"]+)['"]/g)
	];
	if (specifiers.length === 0) return new Set([path]);
	const targets = new Set<string>();
	for (const match of specifiers) {
		const specifier = match[1];
		if (!specifier.startsWith('.')) continue;
		const base = resolve(root, dirname(path), specifier);
		const target = resolveSourcePath(root, base);
		if (target) {
			for (const final of resolveExports(root, target, new Set(visited))) targets.add(final);
		}
	}
	return targets;
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
		return entry.isDirectory()
			? filesBelow(root, path)
			: entry.isFile() && entry.name.endsWith('.ts')
				? [path]
				: [];
	});
}

function safeEntries(directory: string) {
	try {
		return readdirSync(directory, { withFileTypes: true });
	} catch {
		return [];
	}
}

function uidOf(source: string): string | undefined {
	return /@harness-uid\s+(\S+)/.exec(source)?.[1];
}

function exists(path: string): boolean {
	return existsSync(path);
}

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
