import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Fixture writers follow the CLI commit/validate workflow; resource reads never repair themselves. */
export function fixtureGit(root: string, ...args: string[]) {
	const output = execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
	if (args[0] === 'commit') publishFixture(root);
	return output;
}

/** Keep real invalid reports for refusal tests; an unsuccessful producer is never ignored. */
export function publishFixture(root: string, commit = 'HEAD') {
	const exclude = resolve(
		root,
		execFileSync('git', ['rev-parse', '--git-path', 'info/exclude'], {
			cwd: root,
			encoding: 'utf8'
		}).trim()
	);
	mkdirSync(dirname(exclude), { recursive: true });
	if (!existsSync(exclude) || !readFileSync(exclude, 'utf8').includes('/.cache/harness/'))
		appendFileSync(exclude, '\n/.cache/harness/\n');
	const cli = fileURLToPath(new URL('../../../src/index.ts', import.meta.url));
	const result = spawnSync('bun', [cli, 'validate', '--commit', commit, '--write', '--json'], {
		cwd: root,
		encoding: 'utf8'
	});
	if (result.error) throw result.error;
	let report;
	try {
		report = JSON.parse(result.stdout);
	} catch {
		throw new Error(`Fixture metadata producer failed: ${result.stderr}`);
	}
	if (!report.committed) throw new Error(`Fixture metadata was not committed: ${result.stderr}`);
}

/** The run fixture owns opaque source bytes; it exposes no callable or visual contract. */
export function seedOwnedFixture(root: string, source = 'src/owned.ts') {
	const directory = join(root, 'specification/units');
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		join(directory, 'entry.owned.json'),
		JSON.stringify({
			schemaVersion: 1,
			id: 'entry.owned',
			kind: 'entry',
			title: 'Owned source',
			responsibility: 'Hold the committed source bytes edited by isolated fixture agents.',
			responsibilityOrigin: 'declared',
			status: 'active',
			owns: { source: [source], symbols: [] },
			contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
			dependencies: [],
			runtime: { kind: 'module', entry: source, targets: [{ kind: 'module', entry: source }] },
			scenarios: [],
			budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
		})
	);
}
