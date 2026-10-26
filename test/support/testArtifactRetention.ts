import { expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gatherCaptures } from '../../src/utils/verification-evidence/gatherCaptures';
import { focusedScreens } from '../../src/workflows/verification-evidence/record-regression/focusedScreens';
import {
	readRegression,
	regressionHistory
} from '../../src/utils/git-source-history/regressionHistory';
import type { ScenarioManifest } from '../../src/core/unitTypes';
import type { Gathered } from '../../src/utils/verification-evidence/gatherCaptures';
import type { RetainedAudio, SealedAudioFixture } from './testArtifactRetention.types';
import { sealedAudio } from './testArtifactSealedFixture';
import scenario from '../../specification/scenarios/generated-test-artifacts.json';
import contract from '../../specification/units/service.verification-evidence-test-artifact.json';

const revision = 'a'.repeat(40);
const context = {
	commit: revision,
	scenarios: [scenario as ScenarioManifest],
	knownUnits: [contract.id]
};

/** The existing capture method case follows its bytes through focused proof and sealed history. */
export async function assertRetainedClassAudio(directory: string): Promise<void> {
	const gathered = gatherCaptures(directory, 'focused');
	expect(gathered.failures).toEqual([]);
	expect(gathered.gathered).toHaveLength(1);
	const observations = await captureOutcomes(gathered.gathered, directory);
	const item = gathered.gathered[0];
	const sealed = await sealedGathered(item, directory);
	const decoded = await readRegression(sealed.note, async (path) => sealed.files.get(path)).then(
		() => 'decoded',
		(error: Error) => error.message
	);
	const bindings = await observedAudioBindings(item, directory);
	expect(
		[observations.map((item) => item.captures.length), decoded, bindings],
		'class audio must survive focused runs and the sealed reader'
	).toEqual([[1, 1], 'decoded', [true, true, true, true]]);
	for (const retained of observations) {
		await assertAudioProjection(retained);
	}
}

async function assertAudioProjection(retained: RetainedAudio): Promise<void> {
	const { capture, unit } = retained.captures[0];
	expect(unit).toBe(contract.id);
	expect(capture).toMatchObject({
		kind: 'audio',
		mediaType: 'audio/wav',
		durationSeconds: 0.1,
		transcript: '[Generated 440 Hz tone; no spoken words.]',
		sha256: contract.testing.cases[0].expected.value.sha256,
		provenance: 'fixture'
	});
	expect(retained.captures[0]).not.toHaveProperty('viewport');
	await assertSealedAudio(retained);
}

async function observedAudioBindings(item: Gathered, directory: string): Promise<boolean[]> {
	const authored = JSON.parse(item.capture.note!);
	const changes = [
		{ unit: 'service.unknown' },
		{ case: 'unknown' },
		{ revision: 'b'.repeat(40) },
		{ sha256: '0'.repeat(64) }
	];
	return Promise.all(
		changes.map((change) =>
			focusedScreens(
				[
					{
						...item,
						capture: { ...item.capture, note: JSON.stringify({ ...authored, ...change }) }
					}
				],
				directory,
				context
			).then(
				() => false,
				() => true
			)
		)
	);
}

async function assertSealedAudio(retained: RetainedAudio): Promise<void> {
	const sealed = sealedAudio(retained);
	const read = async (path: string) => sealed.files.get(path);
	const loaded = await readRegression(sealed.note, read);
	expect(loaded.files.get(retained.files[0].path)).toEqual(retained.files[0].bytes);
	expect(loaded.record.status).toBe(retained.captures[0].capture.status);
	const notes = new Map([[revision, { entries: [sealed.note], problems: [] }]]);
	const views = await regressionHistory(revision, notes, async () => loaded);
	expect(views[0].gap).toBeUndefined();
	expect(views[0].green!.captures![0].capture).toMatchObject({
		media: expect.any(String),
		transcript: '[Generated 440 Hz tone; no spoken words.]',
		status: loaded.record.status
	});
	const bytes = sealed.files.get(retained.files[0].path)!;
	sealed.files.set(retained.files[0].path, Buffer.from('corrupt audio'));
	await expect(readRegression(sealed.note, read)).rejects.toThrow('different bytes');
	sealed.files.set(retained.files[0].path, bytes);
	expect((await readRegression(sealed.note, read)).record.id).toBe(loaded.record.id);
}

async function captureOutcomes(gathered: Gathered[], directory: string): Promise<RetainedAudio[]> {
	return Promise.all(
		(['passed', 'failed'] as const).map((status) =>
			focusedScreens(
				gathered.map((item) => ({ ...item, capture: { ...item.capture, status } })),
				directory,
				context
			)
		)
	);
}

async function sealedGathered(item: Gathered, directory: string): Promise<SealedAudioFixture> {
	return sealedAudio({
		captures: [{ unit: contract.id, capture: item.capture }],
		files: [{ path: item.capture.path, bytes: await readFile(join(directory, item.line.file)) }]
	});
}
