import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runCommand, runHarness } from './support/cli';

interface Run {
	source: { commit: string | null; dirty: boolean };
	provenance: { kind: string; verified: boolean; note: string };
	measurements: Array<{
		metric: string;
		target: string;
		testedRevision: string | null;
		artifacts: Array<{ sha256: string }>;
	}>;
	default: { runtime: string; basis: string };
}

const identity = ['-c', 'user.name=Harness Fixture', '-c', 'user.email=fixture@harness.invalid'];

async function bench(root: string, output: string): Promise<Run> {
	await runHarness(['kernel', 'bench', '--quick', '--write', output], root);
	return JSON.parse(await readFile(output, 'utf8')) as Run;
}

test('measurements from an uncommitted tree stay explicit calibration with no tested revision', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-calibration-'));
	const outputs = await mkdtemp(join(tmpdir(), 'harness-calibration-out-'));
	const git = (args: string[]) => runCommand(['git', ...identity, ...args], root);
	await writeFile(join(root, 'tracked.txt'), 'one\n');
	await git(['init', '-q', '-b', 'main']);
	await git(['add', '-A']);
	await git(['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'chore: fixture']);
	const commit = (await git(['rev-parse', 'HEAD'])).stdout.trim();

	await writeFile(join(root, 'tracked.txt'), 'two\n');
	const dirty = await bench(root, join(outputs, 'dirty.json'));
	expect(dirty.source).toEqual({ commit, dirty: true });
	expect(dirty.provenance.kind).toBe('calibration');
	expect(dirty.provenance.verified).toBe(false);
	expect(dirty.provenance.note).toMatch(/not verification evidence/);
	expect(dirty.measurements.length).toBeGreaterThan(20);
	expect(dirty.measurements.every((item) => item.testedRevision === null)).toBe(true);
	const wasm = dirty.measurements.find(
		(item) => item.target === 'wasm' && item.metric === 'artifact-bytes'
	);
	expect(wasm?.artifacts[0].sha256).toMatch(/^[0-9a-f]{64}$/);

	const chosen = JSON.parse(
		(
			await runHarness(
				['kernel', 'default', '--json', '--measurements', join(outputs, 'dirty.json')],
				root
			)
		).stdout
	);
	expect(chosen.runtime).toBe(dirty.default.runtime);
	expect(chosen.evidence).toEqual({ kind: 'calibration', verified: false, commit, dirty: true });

	await writeFile(join(root, 'tracked.txt'), 'one\n');
	const clean = await bench(root, join(outputs, 'clean.json'));
	expect(clean.source).toEqual({ commit, dirty: false });
	expect(clean.measurements.every((item) => item.testedRevision === commit)).toBe(true);
	expect(clean.provenance.verified).toBe(false);
	await rm(root, { recursive: true, force: true });
	await rm(outputs, { recursive: true, force: true });
}, 240_000);
