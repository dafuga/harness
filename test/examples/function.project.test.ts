import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { detectGameDimension, detectProjectKind } from '../../src/workflows/projects-sessions/generate-code/project';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

async function makeProject(root: string, manifest?: string, files: string[] = []): Promise<void> {
	if (manifest !== undefined) {
		await writeFile(join(root, 'package.json'), manifest);
	}
	for (const file of files) {
		const path = join(root, file);
		await mkdir(join(path, '..'), { recursive: true });
		await writeFile(path, '');
	}
}

test('Project kind detection follows manifest and file evidence', async () => {
	const cases = await withTempDir('project-kind-examples-', async (root) => {
		const examples = [
			{ name: 'explicit game kind takes precedence', manifest: '{"harness":{"kind":"game"}}', files: ['svelte.config.js'], expected: 'game' },
			{ name: 'SvelteKit check script identifies an app', manifest: '{"scripts":{"check":"svelte-kit sync"}}', expected: 'app' },
			{ name: 'source entry identifies a library', manifest: '{}', files: ['src/index.ts'], expected: 'lib' },
			{ name: 'missing manifest falls back to unknown', expected: 'unknown' }
		];
		const results = [];
		for (let index = 0; index < examples.length; index += 1) {
			const example = examples[index];
			const directory = join(root, String(index));
			await mkdir(directory, { recursive: true });
			await makeProject(directory, example.manifest, example.files);
			results.push({
				name: example.name,
				input: { manifest: example.manifest ?? null, files: example.files ?? [] },
				output: await detectProjectKind(directory)
			});
		}
		return results;
	});
	expect(cases.map((item) => item.output)).toEqual(['game', 'app', 'lib', 'unknown']);
	recordExampleCases(
		{ unitId: 'function.project', symbol: 'detectProjectKind', state: 'project-kind-detection-follows-manifest-and-file-evidence', evidence: 'examples-cases', file: 'project-kind-detection-follows-manifest-and-file-evidence.json' },
		cases
	);
});

test('Game dimension accepts only supported declarations', async () => {
	const cases = await withTempDir('game-dimension-examples-', async (root) => {
		const examples = [
			{ name: 'declared two dimensional game', manifest: '{"harness":{"dimension":"2d"}}', expected: '2d' },
			{ name: 'declared three dimensional game', manifest: '{"harness":{"dimension":"3d"}}', expected: '3d' },
			{ name: 'unsupported dimension is omitted', manifest: '{"harness":{"dimension":"4d"}}', expected: undefined }
		];
		const results = [];
		for (let index = 0; index < examples.length; index += 1) {
			const example = examples[index];
			const directory = join(root, String(index));
			await mkdir(directory, { recursive: true });
			await makeProject(directory, example.manifest);
			results.push({
				name: example.name,
				input: { manifest: example.manifest },
				output: await detectGameDimension(directory)
			});
		}
		return results;
	});
	expect(cases.map((item) => item.output)).toEqual(['2d', '3d', undefined]);
	recordExampleCases(
		{ unitId: 'function.project', symbol: 'detectGameDimension', state: 'game-dimension-accepts-only-supported-declarations', evidence: 'examples-cases', file: 'game-dimension-accepts-only-supported-declarations.json' },
		cases
	);
});

test('Throws TypeError when check script includes is not callable', async () => {
	const cases = await withTempDir('project-kind-type-error-', async (root) => {
		await makeProject(root, '{"scripts":{"check":42}}');
		let error: unknown;
		try {
			await detectProjectKind(root);
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(TypeError);
		return [{
			name: 'truthy check script without callable includes rejects',
			input: { manifest: '{"scripts":{"check":42}}' },
			error: { name: error instanceof Error ? error.name : 'unknown' }
		}];
	});
	recordExampleCases(
		{ unitId: 'function.project', symbol: 'detectProjectKind', state: 'throws-typeerror-when-check-script-includes-is-not-callable', evidence: 'examples-cases', file: 'throws-typeerror-when-check-script-includes-is-not-callable.json' },
		cases
	);
});
