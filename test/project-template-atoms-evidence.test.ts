import { existsSync, readFileSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { test } from 'vitest';
import { benchmarkCaptureSchema, captureIndex } from '../src/core/verifyTypes';
import { nativeAtoms } from '../src/templates/development-tooling/htmlElements.js';
import { projectFiles } from '../src/templates/projects-sessions/project';
import { expect } from './verificationExpect';
import { createTempDirectory } from './support/temporary';
import { assertAtomCompiler } from './support/project-template/atoms';

const registry = join(import.meta.dirname, '../specification/units');
const owner = 'template.project';

test('generated atom evidence names only active registered units or the template owner', async () => {
	const evidence = await createTempDirectory('harness-atom-evidence-');
	const saved = { dir: process.env.HARNESS_EVIDENCE_DIR, take: process.env.TAKE_SCREENSHOT };
	process.env.HARNESS_EVIDENCE_DIR = evidence;
	process.env.TAKE_SCREENSHOT = '1';
	try {
		await assertAtomCompiler();
		const measured = await benchmarkMeasurements(evidence);
		const invalid = measured.filter((entry) => entry.unit !== owner && !isActiveUnit(entry.unit));
		expect(invalid.map((entry) => entry.unit)).toEqual([]);
		const generated = generatedAtomSlugs();
		expect(generated.length).toBe(nativeAtoms.length);
		const active = generated.filter((slug) => isActiveUnit(unitFor(slug)));
		const unregistered = generated.filter((slug) => !isActiveUnit(unitFor(slug)));
		expect(active.length).toBeGreaterThan(0);
		expect(unregistered.length).toBeGreaterThan(0);
		const has = (unit: string, workload: string) =>
			measured.some((entry) => entry.unit === unit && entry.workload === workload);
		expect(
			active.filter((slug) => !has(unitFor(slug), 'compile-native-atom')).map(unitFor)
		).toEqual([]);
		expect(unregistered.filter((slug) => !has(owner, `compile-native-atom-${slug}`))).toEqual([]);
		const compiled = new Set(
			measured
				.filter((entry) => entry.workload?.startsWith('compile-native-atom') === true)
				.map((entry) => `${entry.unit}\u0000${entry.workload}`)
		);
		expect(compiled.size).toBe(generated.length);
	} finally {
		restoreEnv('HARNESS_EVIDENCE_DIR', saved.dir);
		restoreEnv('TAKE_SCREENSHOT', saved.take);
		await rm(evidence, { recursive: true, force: true });
	}
});

async function benchmarkMeasurements(
	evidence: string
): Promise<Array<{ unit: string; workload: string | null }>> {
	const lines = (await readFile(join(evidence, captureIndex), 'utf8')).trim().split('\n');
	const out: Array<{ unit: string; workload: string | null }> = [];
	for (const line of lines.map((text) => JSON.parse(text) as { kind: string; file: string })) {
		if (line.kind !== 'benchmark') continue;
		const capture = benchmarkCaptureSchema.parse(
			JSON.parse(await readFile(join(evidence, line.file), 'utf8'))
		);
		out.push(...capture.measurements);
	}
	return out;
}

/** The generated catalog's atom slugs, read from the same files the compile proof compiles. */
function generatedAtomSlugs(): string[] {
	return projectFiles({ kind: 'app', name: 'atom-proof' })
		.filter((file) => file.path.includes('/atoms/') && file.path.endsWith('.svelte'))
		.map((file) =>
			basename(file.path, '.svelte')
				.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
				.toLowerCase()
		);
}

function unitFor(slug: string): string {
	return `reports.component.shared-primitives-atoms-${slug}`;
}

function isActiveUnit(id: string): boolean {
	const path = join(registry, id + '.json');
	return existsSync(path) && JSON.parse(readFileSync(path, 'utf8')).status === 'active';
}

function restoreEnv(name: string, value: string | undefined): void {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}
