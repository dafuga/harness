import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import tsParser from '@typescript-eslint/parser';
import { Linter } from 'eslint';
import ts from 'typescript';
import { expect, test } from 'vitest';
import allowlist from '../eslint.layer-allowlist.json';

const root = resolve(import.meta.dirname, '..');
const rules = (await import(join(root, 'eslint.harness-rules.js'))) as {
	default: NonNullable<Linter.Config['plugins']>[string];
	layerEdge(filename: string, source: string): { file: string; target: string } | undefined;
};

function lint(path: string, code: string): string[] {
	const config: Linter.Config[] = [
		{
			files: ['**/*.ts'],
			languageOptions: { parser: tsParser },
			plugins: { harness: rules.default },
			rules: { 'harness/layer-direction': 'error' }
		}
	];
	const messages = new Linter({ cwd: root }).verify(code, config, join(root, path));
	return messages.map((message) => message.message);
}

test('utils and services cannot import a higher layer by any import form', () => {
	const upward = [
		['src/utils/a/value.ts', "import { run } from '../../services/a/RunService';"],
		['src/utils/value.ts', "import type { Loop } from './../workflows/loop/loopState';"],
		['src/utils/value.ts', "export * from '../cli/program/console';"],
		['src/utils/value.ts', "export { run } from '../services/RunService.ts';"],
		['src/services/RunService.ts', "export type { Loop } from '../workflows/loop/loopState';"],
		['src/services/a/RunService.ts', "const loaded = import('../../cli/program/load');"],
		['src/services/RunService.ts', "type Loop = import('../workflows/loopState').Loop;"]
	];
	for (const [path, code] of upward)
		expect(lint(path, code), `${path}: ${code}`).toEqual([
			expect.stringMatching(/must not import .*\(src\/(services|workflows|cli)\//)
		]);
});

test('downward, sibling and package imports stay admitted', () => {
	const admitted = [
		['src/utils/value.ts', "import { fail } from '../core/development-tooling/errors';"],
		['src/utils/value.ts', "import { readFile } from 'node:fs/promises';"],
		['src/services/RunService.ts', "import { value } from '../utils/value';"],
		[
			'src/services/RunService.ts',
			"import { RunRepository } from '../repositories/RunRepository';"
		],
		['src/workflows/runThing.ts', "import { RunService } from '../services/RunService';"],
		['src/cli/program/run.ts', "import { runThing } from '../../workflows/runThing';"],
		['src/core/value.ts', "import { other } from './services/other';"]
	];
	for (const [path, code] of admitted) expect(lint(path, code), `${path}: ${code}`).toEqual([]);
});

test('an allowlisted edge is admitted only for its own file and target', () => {
	const [edge] = allowlist.edges;
	const specifier = (from: string) =>
		`./${join(
			...from
				.split('/')
				.slice(0, -1)
				.map(() => '..'),
			edge.to
		)}`;
	expect(lint(edge.from, `export * from '${specifier(edge.from)}';`)).toEqual([]);
	const sibling = edge.from.replace(/[^/]+$/, 'unlisted.ts');
	expect(lint(sibling, `export * from '${specifier(sibling)}';`)).toHaveLength(1);
});

test('the allowlist holds exactly the upward edges still in the tree, each with a TODO', () => {
	const current = new Set<string>();
	for (const file of sourceFiles(join(root, 'src')))
		for (const reference of ts.preProcessFile(readFileSync(file, 'utf8'), true, true)
			.importedFiles) {
			const edge = rules.layerEdge(file, reference.fileName);
			if (edge) current.add(`${edge.file} -> ${edge.target}`);
		}
	const listed = allowlist.edges.map((edge) => `${edge.from} -> ${edge.to}`);
	expect(new Set(listed).size, 'duplicate allowlist entries').toBe(listed.length);
	expect(
		[...current].filter((edge) => !listed.includes(edge)),
		'new upward imports'
	).toEqual([]);
	expect(
		listed.filter((edge) => !current.has(edge)),
		'fixed edges must leave the allowlist'
	).toEqual([]);
	expect(allowlist.edges.filter((edge) => !edge.todo.startsWith('TODO: '))).toEqual([]);
});

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return /\.(ts|js)$/.test(entry.name) ? [path] : [];
	});
}
