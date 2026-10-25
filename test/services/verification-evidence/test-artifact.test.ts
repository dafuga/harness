import { expect, test } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TestArtifactService } from '../../../src/services/verification-evidence/TestArtifactService';
import contract from '../../../specification/units/service.verification-evidence-test-artifact.json';
import { audioFixture } from '../../../packages/reports/test/audioFixture';

test('capture initialized audio artifacts retains playable bytes and rejects invalid properties', () => {
	const directory = mkdtempSync(join(tmpdir(), 'harness-case-artifact-'));
	try {
		const service = new TestArtifactService({
			HARNESS_EVIDENCE_DIR: directory,
			HARNESS_VERIFY_REVISION: 'a'.repeat(40)
		});
		const artifact = {
			unit: 'service.tone',
			case: 'capture-initialized',
			state: 'initialized',
			evidence: 'generated-audio',
			file: 'tone.wav',
			bytes: audioFixture(0.1),
			transcript: '[Generated 440 Hz tone; no spoken words.]',
			provenance: 'fixture' as const
		};
		const result = service.capture(artifact);
		expect(readFileSync(join(directory, result.file))).toEqual(artifact.bytes);
		expect(result).toEqual(contract.testing.cases[0].expected.value);
		new TestArtifactService().capture({
			...artifact,
			unit: 'service.verification-evidence-test-artifact'
		});
		const line = JSON.parse(readFileSync(join(directory, 'captures.ndjson'), 'utf8').trim());
		expect(line.transcript).toBe(artifact.transcript);
		expect(JSON.parse(line.note)).toMatchObject({
			unit: artifact.unit,
			case: artifact.case,
			revision: 'a'.repeat(40),
			sha256: result.sha256
		});
		assertInvalidArtifacts(service, artifact);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

function assertInvalidArtifacts(
	service: TestArtifactService,
	artifact: Parameters<TestArtifactService['capture']>[0]
) {
	for (const changed of [
		{ ...artifact, transcript: '' },
		{ ...artifact, unit: 'invalid/id' },
		{ ...artifact, case: 'invalid/id' },
		{ ...artifact, provenance: 'observed' as never },
		{ ...artifact, bytes: Buffer.from('not WAV') },
		{ ...artifact, file: '../escape.wav' }
	])
		expect(() => service.capture(changed)).toThrow();
}
