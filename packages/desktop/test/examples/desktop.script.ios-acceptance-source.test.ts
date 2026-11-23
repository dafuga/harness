import { test } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	rendererSources,
	nativeSources,
	computerSources,
	tree,
	treeDigest,
	missing,
	moved,
	named,
	movedSources
} from '../../scripts/ios-acceptance-source';
import type { SourceReading } from '../../scripts/ios-acceptance-source.types';

test('describes the renderer native and fixture source sets', () => {
	const output = { rendererSources, nativeSources, computerSources };
	expect(rendererSources).toContain('bun.lock');
	expect(nativeSources).toEqual(['packages/desktop/ios', 'packages/desktop/capacitor.config.ts']);
	expect(computerSources).toContain('packages/desktop/scripts');
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-source',
			symbol: 'rendererSources',
			state: 'describes-the-renderer-native-and-fixture-source-sets',
			evidence: 'examples-cases',
			file: 'describes-the-renderer-native-and-fixture-source-sets.json'
		},
		[{ name: 'declared source inputs', input: null, output }]
	);
});

test('compares source maps and names their digest', () => {
	const before = new Map([
		['bun.lock', 'lock-a'],
		['packages/desktop/package.json', 'pkg-a']
	]);
	const after = new Map([
		['bun.lock', 'lock-a'],
		['packages/desktop/package.json', 'pkg-b'],
		['packages/desktop/svelte.config.js', 'svelte-a']
	]);
	const output = {
		digest: treeDigest(before),
		missing: missing(before, after),
		moved: moved(before, after),
		named: named(before)
	};
	expect(output.missing).toEqual(['packages/desktop/package.json']);
	expect(output.moved).toEqual([
		'packages/desktop/package.json',
		'packages/desktop/svelte.config.js'
	]);
	expect(output.named).toEqual({ digest: output.digest, files: 2 });
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-source',
			symbol: 'moved',
			state: 'compares-source-maps-and-names-their-digest',
			evidence: 'examples-cases',
			file: 'compares-source-maps-and-names-their-digest.json'
		},
		[
			{
				name: 'changed and added source paths',
				input: { before: Object.fromEntries(before), after: Object.fromEntries(after) },
				output
			}
		]
	);
});

test('finds changes across the three source readings', () => {
	const before: SourceReading = {
		renderer: new Map([['bun.lock', 'lock-a']]),
		native: new Map([['packages/desktop/ios/App.swift', 'app-a']]),
		fixtureComputer: new Map([['packages/desktop/scripts/runner.ts', 'runner-a']])
	};
	const after: SourceReading = {
		renderer: new Map([['bun.lock', 'lock-b']]),
		native: new Map([['packages/desktop/ios/App.swift', 'app-a']]),
		fixtureComputer: new Map([['packages/desktop/scripts/runner.ts', 'runner-a']])
	};
	const output = movedSources(before, after);
	expect(output).toEqual(['bun.lock']);
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-source',
			symbol: 'movedSources',
			state: 'finds-changes-across-the-three-source-readings',
			evidence: 'examples-cases',
			file: 'finds-changes-across-the-three-source-readings.json'
		},
		[
			{
				name: 'renderer changed between reads',
				input: {
					before: 'one renderer, native, and fixture reading',
					after: 'same sets with a changed lockfile'
				},
				output
			}
		]
	);
});

test('Throws Error when a tree path is a file', () => {
	const folder = mkdtempSync(join(tmpdir(), 'ios-source-'));
	const file = join(folder, 'not-a-folder');
	writeFileSync(file, 'example');
	try {
		expect(() => tree(file)).toThrow();
		recordExampleCases(
			{
				unitId: 'desktop.script.ios-acceptance-source',
				symbol: 'tree',
				state: 'throws-error-when-a-tree-path-is-a-file',
				evidence: 'examples-cases',
				file: 'throws-error-when-a-tree-path-is-a-file.json'
			},
			[
				{
					name: 'file supplied as tree folder',
					input: { folder: 'temporary regular file' },
					error: 'Error'
				}
			]
		);
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
});
