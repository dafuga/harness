import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { auditPath, auditProject } from '../../src/audit/development-tooling/audit';
import type { AuditResult } from '../../src/audit/development-tooling/adapters/types';
import { isExpectedCliError } from '../../src/core/development-tooling/errors';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * Each public operation is called on a temporary project folder, with the options runAudit passes
 * to auditProject. What it was given and what it returned, or why it refused, is asserted and
 * recorded as the cases of its state. Temporary paths are recorded as the names they stand for,
 * and listings are sorted because directory order differs between file systems.
 */

type Files = Record<string, string>;
type Options = Parameters<typeof auditPath>[1];
type Finding = AuditResult['findings'][number];

const version = "export const version = '1.0.0';\n";
const twoClasses = 'export class Money {}\nexport class Currency {}\n';
const ignoreMoney = '{"ignore":[{"path":"src/lib/money.ts","rule":"max-classes-per-file"}]}';
const cutOff = '{ "limits": ';
const zeroLimit = '{ "limits": { "maxFileLines": 0 } }';
const badMode = '{ "cleanCode": { "mode": "sometimes" } }';
const ledger = Array.from({ length: 221 }, (_, index) => `export const row${index} = ${index};`);
const reviewOnly = { cleanCode: { enabled: true, dryRun: true } };
const dryRunOnly = { cleanCode: { dryRun: true } };
const gitIgnored = { path: 'generated/client.ts', reason: 'Git ignored' };

const cleanFiles: Files = { 'src/index.ts': version };
const libraryFiles: Files = {
	'harness.audit.json': ignoreMoney,
	'src/app/checkout-form.tsx': 'export const CheckoutForm = () => null;\n',
	'src/index.ts': version,
	'src/lib/ledger.ts': `${ledger.join('\n')}\n`,
	'src/lib/money.ts': twoClasses
};
const libraryCoverage: Files = {
	'dist/index.js': 'export {};\n',
	'node_modules/left-pad/index.js': 'module.exports = {};\n',
	'src/index.ts': version,
	'tools/gen/main.go': 'package main\n'
};
const appCoverage: Files = {
	'.svelte-kit/output.js': 'export {};\n',
	'harness.audit.json': ignoreMoney,
	'src/lib/Banner.svelte': '<script lang="ts">\n\tlet n = 0;\n</script>\n<p>{n}</p>\n',
	'src/lib/money.ts': twoClasses,
	'svelte.config.js': 'export default {};\n',
	'tools/gen/main.go': 'package main\n'
};
const repoFiles: Files = {
	'.gitignore': 'generated/\n',
	'generated/client.ts': 'export const client = {};\n',
	'src/index.ts': version,
	'src/lib/money.ts': twoClasses
};

/** Writes each relative path with its contents, creating the folders it needs. */
async function writeFiles(root: string, files: Files): Promise<void> {
	for (const [path, contents] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), contents);
	}
}

/** Runs one call on a new project folder that holds the files; the folder is removed afterwards. */
const inProject = <T>(files: Files, call: (root: string) => Promise<T>) =>
	withTempDir('harness-audit-audit-', async (root) => {
		await writeFiles(root, files);
		return call(root);
	});

/** How a call refused: an expected CLI error by its message, any other by its name and code. */
async function refusedBy(files: Files, call: (root: string) => Promise<unknown>) {
	const failure: unknown = await inProject(files, call).catch((error: unknown) => error);
	if (!(failure instanceof Error)) throw new Error('The call was expected to refuse.');
	const { name, code } = failure as Error & { code?: string };
	if (isExpectedCliError(failure)) return { name, message: failure.message };
	return code ? { name, code } : { name };
}

const sortedFindings = (findings: Finding[]) =>
	[...findings].sort((a, b) => a.path.localeCompare(b.path) || a.rule.localeCompare(b.rule));

/** The findings and coverage of an audit, with every listing sorted. */
function listed({ findings, coverage }: AuditResult) {
	return {
		findings: sortedFindings(findings),
		coverage: {
			profile: coverage.profile,
			adapters: coverage.adapters.map(({ id, files }) => ({ id, files: files.sort() })),
			coveredFiles: coverage.coveredFiles.sort(),
			ignoredPaths: coverage.ignoredPaths.sort(),
			ignoredFindings: sortedFindings(coverage.ignoredFindings),
			unknownFiles: coverage.unknownFiles.sort()
		}
	};
}

const pathFindings = (files: Files, options?: Options) =>
	inProject(files, async (root) => sortedFindings(await auditPath(root, options)));
const projectListing = (files: Files, options?: Options) =>
	inProject(files, async (root) => listed(await auditProject(root, options)));
const given = (files: Files, options?: Options) => ({ files: Object.keys(files).sort(), options });
const configured = (text: string) => ({ 'harness.audit.json': text });
const refusedConfig = (text: string) =>
	refusedBy({ 'harness.audit.json': text }, (root) => auditProject(root));
const at = (name: string) => (root: string) => auditProject(join(root, name));

test('auditPath returned the findings of a library without the one its ignore entry matches, the same under a dry-run review, and none for a clean project', async () => {
	const library = await pathFindings(libraryFiles);
	const clean = await pathFindings(cleanFiles);
	const reviewed = await pathFindings(libraryFiles, reviewOnly);
	expect(library.map((finding) => finding.rule)).toEqual(['react-component-name', 'small-file']);
	expect(clean).toEqual([]);
	expect(reviewed).toEqual(library);
	recordExampleCases(
		{
			unitId: 'audit.audit',
			symbol: 'auditPath',
			state: 'auditpath-returned-the-findings-of-a-library-without-the-one',
			evidence: 'examples-cases',
			file: 'auditpath-returned-the-findings-of-a-library-without-the-one.json'
		},
		[
			{ name: 'a library with an ignore entry', input: given(libraryFiles), output: library },
			{ name: 'a clean project', input: given(cleanFiles), output: clean },
			{ name: 'library, dry-run review', input: given(libraryFiles, reviewOnly), output: reviewed }
		]
	);
});

test('auditProject described the coverage of a library and of a SvelteKit app with ignored paths, ignored findings and unknown files', async () => {
	const library = await projectListing(libraryCoverage);
	const app = await projectListing(appCoverage);
	expect([library.coverage.profile, app.coverage.profile]).toEqual(['lib', 'app']);
	expect(library.coverage.ignoredPaths).toEqual(['dist/', 'node_modules/']);
	expect(app.coverage.ignoredFindings[0]?.rule).toBe('max-classes-per-file');
	expect(app.coverage.unknownFiles).toEqual(['tools/gen/main.go']);
	recordExampleCases(
		{
			unitId: 'audit.audit',
			symbol: 'auditProject',
			state: 'auditproject-described-the-coverage-of-a-library-and-of-a-sv',
			evidence: 'examples-cases',
			file: 'auditproject-described-the-coverage-of-a-library-and-of-a-sv.json'
		},
		[
			{ name: 'a library root', input: given(libraryCoverage), output: library },
			{ name: 'a SvelteKit root', input: given(appCoverage), output: app }
		]
	);
});

test('auditProject added a dry-run clean-code report for the selected source files and refused a dry run with review off', async () => {
	const repo = await withTempRepo(async ({ root }) => {
		await writeFiles(root, repoFiles);
		const result = await auditProject(root, reviewOnly);
		return { findings: sortedFindings(result.findings), cleanCode: result.cleanCode };
	});
	const refused = await refusedBy(cleanFiles, (root) => auditProject(root, dryRunOnly));
	expect(repo.cleanCode?.status).toBe('dry-run');
	expect(repo.cleanCode?.coverage.selectedFiles).toEqual(['src/index.ts', 'src/lib/money.ts']);
	expect(repo.cleanCode?.coverage.excludedPaths).toContainEqual(gitIgnored);
	expect(refused.message).toBe(
		'Invalid harness.audit.json cleanCode.mode: enable review with --clean-code.'
	);
	recordExampleCases(
		{
			unitId: 'audit.audit',
			symbol: 'auditProject',
			state: 'auditproject-added-a-dry-run-clean-code-report-for-the-selec',
			evidence: 'examples-cases',
			file: 'auditproject-added-a-dry-run-clean-code-report-for-the-selec.json'
		},
		[
			{ name: 'a repository, dry-run review', input: given(repoFiles, reviewOnly), output: repo },
			{ name: 'a dry run, review off', input: given(cleanFiles, dryRunOnly), error: refused }
		]
	);
});

test('auditProject refused a root that is missing, a root that is a file and a harness.audit.json folder with their error codes', async () => {
	const missing = await refusedBy(cleanFiles, at('missing-folder'));
	const file = await refusedBy({ 'README.md': '# Demo\n' }, at('README.md'));
	const folder = await refusedBy({}, async (root) => {
		await mkdir(join(root, 'harness.audit.json'));
		return auditProject(root);
	});
	expect(missing).toEqual({ name: 'Error', code: 'ENOENT' });
	expect(file).toEqual({ name: 'Error', code: 'ENOTDIR' });
	expect(folder).toEqual({ name: 'Error', code: 'EISDIR' });
	recordExampleCases(
		{
			unitId: 'audit.audit',
			symbol: 'auditProject',
			state: 'auditproject-refused-a-root-that-is-missing-a-root-that-is-a',
			evidence: 'examples-cases',
			file: 'auditproject-refused-a-root-that-is-missing-a-root-that-is-a.json'
		},
		[
			{ name: 'a missing folder', input: { root: 'project/missing-folder' }, error: missing },
			{ name: 'a README file', input: { root: 'project/README.md' }, error: file },
			{ name: 'a harness.audit.json folder', input: configured('a folder'), error: folder }
		]
	);
});

test('auditProject refused a harness.audit.json cut off before its end, holding null, with a zero limit or an invalid cleanCode mode', async () => {
	const cut = await refusedConfig(cutOff);
	const nothing = await refusedConfig('null');
	const zero = await refusedConfig(zeroLimit);
	const mode = await refusedConfig(badMode);
	expect(cut).toEqual({ name: 'SyntaxError' });
	expect(nothing).toEqual({ name: 'TypeError' });
	expect(zero.message).toBe('harness.audit.json limits.maxFileLines must be a positive integer.');
	expect(mode.message).toBe('Invalid harness.audit.json cleanCode.mode.');
	recordExampleCases(
		{
			unitId: 'audit.audit',
			symbol: 'auditProject',
			state: 'auditproject-refused-a-harness-audit-json-cut-off-before-its',
			evidence: 'examples-cases',
			file: 'auditproject-refused-a-harness-audit-json-cut-off-before-its.json'
		},
		[
			{ name: 'a cut-off configuration', input: configured(cutOff), error: cut },
			{ name: 'a null configuration', input: configured('null'), error: nothing },
			{ name: 'a zero limit', input: configured(zeroLimit), error: zero },
			{ name: 'a bad cleanCode mode', input: configured(badMode), error: mode }
		]
	);
});
