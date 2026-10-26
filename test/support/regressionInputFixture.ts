import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { GitAdapter } from '../../src/adapters/git-source-history/GitAdapter';
import { regressionFiles } from '../../src/utils/verification-evidence/regressionFiles';
import { sampleUnit } from './loop-repair/sampleUnit';
import type {
	FrozenFixtureInputs,
	RegressionInputFixture,
	FixtureRecordInput
} from './regressionInputFixture.types';

export const fixtureUnitPath = 'specification/units/function.sample.json';
export const authoredFixtureDigest =
	'fd63e897e7a32736971982f3ea0391e224e13f115cbfe9c61246fc8cc407cf83';
const source = 'export function selectedValue(): number { return 1; }';

/** Disposable real Git commits; this synthetic failed record is never persisted as evidence. */
export async function regressionInputFixture(): Promise<RegressionInputFixture> {
	const root = await mkdtemp(join(tmpdir(), 'harness-authored-inputs-'));
	const git = (args: string[]) => new GitAdapter(root).run(args);
	await git(['init', '-q', '--object-format=sha1']);
	await git(['config', 'user.name', 'Harness Fixture']);
	await git(['config', 'user.email', 'fixture@harness.invalid']);
	await git(['config', 'core.hooksPath', '/dev/null']);
	const unit = globalThis.structuredClone(sampleUnit);
	unit.testing!.cases[0].test.file = 'test/proof.ts';
	const commit = async (changes: Record<string, string>) => {
		for (const [path, text] of Object.entries(changes)) {
			await mkdir(dirname(join(root, path)), { recursive: true });
			await writeFile(join(root, path), text);
		}
		await git(['add', '-A']);
		await git(['commit', '-qm', 'fix: synthetic authored input fixture']);
		return git(['rev-parse', 'HEAD']);
	};
	await commit({
		'source.ts': source,
		'test/proof.ts': 'export const selected = 1;',
		[fixtureUnitPath]: JSON.stringify(unit),
		'test/support/data.json': '[3]',
		'package.json': '{}',
		'harness.verify.json': '{}',
		'vitest.config.ts': 'export default {};'
	});
	const redCommit = await commit({ 'test/proof.ts': 'export const selected = 3;' });
	const raw: unknown = await regressionFiles(root, redCommit, ['test/proof.ts']);
	const inputs = Array.isArray(raw) ? raw : (raw as FrozenFixtureInputs).inputs;
	const red = await failedRecord({ git, unit, commit: redCommit, inputs });
	return { root, git, unit, commit, red, close: () => rm(root, { recursive: true, force: true }) };
}

async function failedRecord({
	git,
	unit,
	commit: redCommit,
	inputs
}: FixtureRecordInput): Promise<RegressionInputFixture['red']> {
	return {
		schemaVersion: 1 as const,
		id: 'a'.repeat(64),
		loop: 'fixture',
		phase: 'red' as const,
		status: 'failed' as const,
		source: {
			commit: redCommit,
			tree: await git(['rev-parse', 'HEAD^{tree}']),
			parent: await git(['rev-parse', 'HEAD^'])
		},
		tests: ['test/proof.ts'],
		units: [unit.id],
		inputs,
		expectations: [
			{
				unit: unit.id,
				path: fixtureUnitPath,
				blob: await git(['rev-parse', redCommit + ':' + fixtureUnitPath]),
				sha256: authoredFixtureDigest
			}
		],
		command: 'fixture',
		assertion: 'synthetic failed fixture',
		profile: 'fixture',
		startedAt: 'fixture',
		finishedAt: 'fixture',
		exitCode: 1,
		log: {
			path: 'output.log' as const,
			bytes: 0,
			sha256: createHash('sha256').update('').digest('hex')
		}
	};
}
