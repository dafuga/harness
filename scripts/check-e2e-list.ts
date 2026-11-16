// @harness-uid u_3mciuyjhwa
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExpectedCliError } from '../src/core/errors';

export function declaredE2eTests(script: string): string[] {
	return [...script.matchAll(/(test\/[\w./-]+\.e2e\.test\.ts)(?=\s|$)/g)]
		.map((match) => match[1]!)
		.sort();
}

export function compareE2eTests(
	actualFiles: readonly string[],
	declaredFiles: readonly string[]
): { missing: string[]; stale: string[] } {
	const actual = new Set(actualFiles);
	const declared = new Set(declaredFiles);
	return {
		missing: [...actual].filter((file) => !declared.has(file)).sort(),
		stale: [...declared].filter((file) => !actual.has(file)).sort()
	};
}

function discoverE2eTests(directory = 'test', parent = ''): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		const relative = parent ? `${parent}/${entry.name}` : entry.name;
		if (entry.isDirectory()) return discoverE2eTests(path, relative);
		return entry.isFile() && relative.endsWith('.e2e.test.ts') ? [`test/${relative}`] : [];
	});
}

function main(): void {
	const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
		scripts?: Record<string, string>;
	};
	const scripts = ['test:e2e', 'test:package'].map((name) => {
		const script = packageJson.scripts?.[name];
		if (!script) throw new ExpectedCliError(`package.json is missing the ${name} script.`);
		return declaredE2eTests(script);
	});
	const actualFiles = discoverE2eTests();
	const { missing, stale } = compareE2eTests(actualFiles, scripts.flat());
	if (missing.length || stale.length) {
		for (const file of missing) console.error(`Missing from root E2E scripts: ${file}`);
		for (const file of stale) console.error(`Not found on disk: ${file}`);
		process.exitCode = 1;
		return;
	}
	console.log(`Root E2E scripts list all ${actualFiles.length} E2E files.`);
}

if (import.meta.main) main();
