import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BugClass } from '../../../src/core/development-tooling/bug-class/bugClassSchemas.types';
import type { TemporaryRepo } from '../temporary.types';

export const fixtureBugClass: BugClass = {
	id: 'eager-parse',
	title: 'Eager bulk parsing',
	cause: 'Synchronous parsing of a large collection blocks the current task.',
	criteria: 'A large collection is parsed before it is requested.',
	patterns: [
		{ kind: 'call', value: 'JSON.parse', weight: 5 },
		{ kind: 'text', value: 'for (const', weight: 2 }
	],
	contextTerms: ['records', 'load'],
	pathHints: []
};

export async function fixtureSource(repo: TemporaryRepo) {
	await mkdir(join(repo.root, 'src'), { recursive: true });
	await writeFile(
		join(repo.root, 'src/bulk.ts'),
		[
			'// A comment resembling a syntax pattern: JSON.parse(x)',
			'export function load(records: string[]) {',
			'  for (const record of records) JSON["parse"](record);',
			'}'
		].join('\n')
	);
	await writeFile(
		join(repo.root, 'src/small.svelte'),
		[
			'<section>hello</section>',
			'<script lang="ts">',
			'  const one = JSON.parse("0");',
			'</script>'
		].join('\n')
	);
	repo.git('add', 'src');
	repo.git('commit', '-qm', 'feat: record source fixture');
}

export async function fixtureEvaluator(root: string) {
	const bin = join(root, 'test-bin');
	await mkdir(bin, { recursive: true });
	const script = [
		'#!/usr/bin/env bun',
		'const last = process.argv.indexOf("--output-last-message");',
		'if (last < 0 || !process.argv.includes("read-only") || process.env.HARNESS_FIXTURE_SECRET) process.exit(42);',
		'const prompt = await Bun.stdin.text();',
		'const data = JSON.parse(prompt.trimEnd().split("\\n").at(-1));',
		'const result = data.candidates ? { results: data.candidates.map(site => ({',
		'  id: site.id, verdict: site.path.includes("bulk") ? "confirmed" : "dismissed",',
		'  impact: 3, evidence: "The source shows the trigger and its collection scope."',
		'})) } : ' + JSON.stringify(fixtureBugClass) + ';',
		'await Bun.write(process.argv[last + 1], JSON.stringify(result));'
	].join('\n');
	await writeFile(join(bin, 'codex'), script, { mode: 0o755 });
	return {
		PATH: bin + ':' + process.env.PATH,
		HARNESS_RESOURCES_HOME: join(bin, 'resources'),
		HARNESS_RESOURCE_LEASE: '',
		HARNESS_FIXTURE_SECRET: 'private-fixture-marker'
	};
}
