import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestArtifactService } from '../../../../src/services/verification-evidence/TestArtifactService';
import manifest from '../../../../specification/units/reports.service.audio-upload.json' with { type: 'json' };
import { AudioUploadService } from '../../src/services/AudioUploadService';
import { ReportRepository } from '../../src/repositories/report-repository/ReportRepository';
import { audioFixture } from '../audioFixture';

const roots: string[] = [];
const caseRoot =
	process.env.HARNESS_VERIFY_CASE_ROOT ?? fileURLToPath(new URL('../../../../', import.meta.url));
const artifacts = new TestArtifactService({ ...process.env, HARNESS_VERIFY_CASE_ROOT: caseRoot });

export async function cleanupAudioFixtures() {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
}

export async function fixture(row: (typeof manifest.testing.cases)[number]) {
	const root = await mkdtemp(join(tmpdir(), 'audio-upload-'));
	roots.push(root);
	const store = new ReportRepository(root);
	const run = await store.begin({
		project: '/tmp/audio',
		title: 'Audio upload',
		mode: 'feature',
		environment: 'local fixture'
	});
	const pair = row.subject === 'AudioUploadService.uploadComparison';
	const firstFrequency = pair ? row.input.beforeFrequency : row.input.singleFrequency;
	const first = audioFixture(row.input.seconds, firstFrequency);
	const second = pair ? audioFixture(row.input.seconds, row.input.afterFrequency) : first;
	retain(row, pair ? 'comparison-before' : 'single-audio', first, firstFrequency);
	if (pair) retain(row, 'comparison-after', second, row.input.afterFrequency);
	return {
		store,
		run,
		service: new AudioUploadService(store),
		pair,
		first,
		second,
		details: { title: row.input.title, note: row.input.note, source: row.input.source },
		files: {
			audio: new File([first], 'voice.wav'),
			before: new File([first], 'before.wav'),
			after: new File([second], 'after.wav')
		}
	};
}

function retain(
	row: (typeof manifest.testing.cases)[number],
	evidence: string,
	bytes: Buffer,
	frequency: number
) {
	artifacts.capture({
		unit: manifest.id,
		case: row.id,
		state: row.state,
		evidence,
		file: `${row.id}-${evidence}.wav`,
		bytes,
		transcript: `[Synthetic ${row.input.seconds}-second ${frequency} Hz tone; no spoken words.]`,
		provenance: 'fixture'
	});
}
