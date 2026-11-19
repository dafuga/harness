import { test } from 'vitest';
import { complexityCoverage } from '../../src/services/development-tooling/source-index-service/complexityCoverage';
import { uncountedLanguage } from '../../src/utils/development-tooling/complexityCoverage';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * Each classification is called the way its callers call it: complexityCoverage with a path and
 * the scripted flag of an HTML file, uncountedLanguage with a path. 'unsupported' is a coverage
 * class of its own and is never reported as zero decision points. What each call was given and
 * what it returned is asserted and recorded as the cases of its state.
 */

/** Classifies a file as the source index does; the path and the flag are kept with the class. */
function classified(name: string, input: { path: string; scripted?: boolean }) {
	return { name, input, output: complexityCoverage(input.path, input.scripted) };
}

/** Names a file as an uncounted language and classifies it; both results are kept per case. */
function named(name: string, input: { path: string; scripted?: boolean }) {
	return {
		name,
		input,
		output: {
			coverage: complexityCoverage(input.path, input.scripted),
			language: uncountedLanguage(input.path)
		}
	};
}

test('Counts supported source', () => {
	const cases = [
		classified('a TypeScript module', { path: 'src/utils/development-tooling/pick.ts' }),
		classified('a TSX component', { path: 'packages/desk/src/components/Button.tsx' }),
		classified('an ES module script', { path: 'scripts/release.mjs' }),
		classified('a CommonJS script', { path: 'scripts/legacy.cjs' }),
		classified('a JavaScript file with an upper-case extension', { path: 'src/LegacyView.JS' }),
		classified('a Svelte component', { path: 'src/routes/+page.svelte' }),
		classified('a TypeScript module flagged as scripted', {
			path: 'src/utils/development-tooling/pick.ts',
			scripted: true
		})
	];
	expect(cases.map(({ output }) => output)).toEqual([
		'counted',
		'counted',
		'counted',
		'counted',
		'counted',
		'counted',
		'counted'
	]);
	recordExampleCases(
		{
			unitId: 'function.complexity-coverage',
			symbol: 'complexityCoverage',
			state: 'counts-supported-source',
			evidence: 'examples-cases',
			file: 'counts-supported-source.json'
		},
		cases
	);
});

test('Recognizes declarative files', () => {
	const cases = [
		classified('a package manifest', { path: 'package.json' }),
		classified('a Cargo manifest', { path: 'crates/counter/Cargo.toml' }),
		classified('a CI workflow', { path: '.github/workflows/ci.yml' }),
		classified('a YAML config', { path: 'config/deploy.yaml' }),
		classified('a Markdown guide', { path: 'docs/architecture.md' }),
		classified('a plain text note', { path: 'notes/todo.txt' }),
		classified('a stylesheet', { path: 'src/app.css' }),
		classified('an SVG icon', { path: 'assets/logo.svg' }),
		classified('a lockfile', { path: 'bun.lock' }),
		classified('a plain HTML page', { path: 'public/index.html', scripted: false }),
		classified('a plain HTML page with the flag left out', { path: 'public/index.html' })
	];
	expect(cases.map(({ output }) => output)).toEqual(
		Array.from({ length: 11 }, () => 'declarative')
	);
	recordExampleCases(
		{
			unitId: 'function.complexity-coverage',
			symbol: 'complexityCoverage',
			state: 'recognizes-declarative-files',
			evidence: 'examples-cases',
			file: 'recognizes-declarative-files.json'
		},
		cases
	);
});

test('Identifies uncounted code', () => {
	const cases = [
		named('Rust source', { path: 'src/bin/worker.rs' }),
		named('Python script', { path: 'tools/seed_db.py' }),
		named('shell script', { path: 'scripts/release.sh' }),
		named('SQL migration', { path: 'db/migrations/0001_init.sql' }),
		named('Go source', { path: 'cmd/api/main.go' }),
		named('C header', { path: 'include/ring.h' }),
		named('C++ source', { path: 'src/engine.cpp' }),
		named('HTML page with an inline script', { path: 'web/index.html', scripted: true }),
		named('Scala source, an extension no class names', { path: 'pkg/theme.scala' }),
		named('an executable with no extension', { path: 'bin/deploy' }),
		named('a dotfile, which has no extension', { path: '.gitignore' }),
		named('a counted file, which is named anyway', { path: 'src/utils/pick.ts' })
	];
	expect(cases.map(({ output }) => output.coverage)).toEqual([
		'unsupported',
		'unsupported',
		'unsupported',
		'unsupported',
		'unsupported',
		'unsupported',
		'unsupported',
		'unsupported',
		'unsupported',
		'unsupported',
		'unsupported',
		'counted'
	]);
	expect(cases.map(({ output }) => output.language)).toEqual([
		'Rust',
		'Python',
		'shell',
		'SQL',
		'Go',
		'C',
		'C++',
		'HTML with an inline script',
		'.scala files',
		'files without an extension',
		'files without an extension',
		'.ts files'
	]);
	recordExampleCases(
		{
			unitId: 'function.complexity-coverage',
			symbol: 'uncountedLanguage',
			state: 'identifies-uncounted-code',
			evidence: 'examples-cases',
			file: 'identifies-uncounted-code.json'
		},
		cases.map(({ name, input, output }) => ({ name, input: input.path, output: output.language }))
	);
});
