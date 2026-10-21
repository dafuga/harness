import { basename, dirname, extname, join } from 'node:path';

export function relatedReviewPaths(target: string, code: string, files: string[]): string[] {
	const allowed = new Set(files);
	const imports = importCandidates(target, code).filter(
		(path) => allowed.has(path) && path !== target
	);
	const tests = matchingTests(target, files).filter((path) => path !== target);
	return [...new Set([...imports.slice(0, 4), ...tests.slice(0, 2)])];
}

export function reviewConventionPaths(target: string): string[] {
	const paths = ['AGENTS.md', '.codex/skills/harness/SKILL.md', 'harness.audit.json'];
	let directory = dirname(target);
	while (directory !== '.' && paths.length < 7) {
		paths.push(`${directory}/AGENTS.md`);
		directory = dirname(directory);
	}
	return paths;
}

function importCandidates(target: string, code: string): string[] {
	const matches = [
		...code.matchAll(/(?:from\s+|import\s*|require\(\s*|#include\s*)['"]([^'"]+)['"]/g)
	];
	const python = [...code.matchAll(/from\s+(\.[\w.]*)\s+import/g)].flatMap((match) =>
		pythonCandidates(target, match[1])
	);
	const paths = matches.flatMap((match) => sourceCandidates(target, match[1]));
	return [...paths, ...python].map((path) => path.replaceAll('\\', '/'));
}

function sourceCandidates(target: string, source: string): string[] {
	let path: string;
	if (source.startsWith('.')) path = join(dirname(target), source);
	else if (source.startsWith('$lib/')) path = join('src/lib', source.slice(5));
	else if (source.startsWith('@/')) path = join('src', source.slice(2));
	else return [];
	const stem = path.replace(/\.(js|jsx|mjs)$/, '');
	return [
		path,
		...['.ts', '.tsx', '.js', '.jsx', '.svelte', '.py', '.h', '.hpp', '/index.ts', '/index.js'].map(
			(suffix) => stem + suffix
		)
	];
}

function pythonCandidates(target: string, source: string): string[] {
	const dots = source.match(/^\.+/)?.[0].length ?? 1;
	const module = source.slice(dots).replaceAll('.', '/');
	const prefix = '../'.repeat(dots - 1);
	return [
		join(dirname(target), prefix, `${module}.py`),
		join(dirname(target), prefix, module, '__init__.py')
	];
}

function matchingTests(target: string, files: string[]): string[] {
	const stem = basename(target, extname(target))
		.replace(/[^a-zA-Z0-9]/g, '')
		.toLowerCase();
	return files.filter((path) => {
		const name = basename(path)
			.replace(/(\.test|\.spec)?\.[^.]+$/, '')
			.replace(/^test_/, '')
			.replace(/[^a-zA-Z0-9]/g, '')
			.toLowerCase();
		return name === stem && /(^test[s]?\/|\.test\.|\.spec\.|\/test_)/.test(path);
	});
}
