import type { RegressionRecord } from '../../src/core/verification-evidence/regressionTypes';
import type { RetainedAudio, SealedAudioFixture } from './testArtifactRetention.types';
import { canonicalJson } from '../../src/utils/development-tooling/canonicalJson';
import { regressionHash } from '../../src/utils/git-source-history/regressionHistory';
import contract from '../../specification/units/service.verification-evidence-test-artifact.json';

// Synthetic fixture identities exercise the sealed-reader boundary without claiming live Git proof.
const revision = 'a'.repeat(40);

function audioRecord(retained: RetainedAudio): Omit<RegressionRecord, 'id'> {
	const output = Buffer.from('fixture class audio outcome\n');
	const status = retained.captures[0].capture.status;
	return {
		schemaVersion: 1,
		loop: 'audio-fixture',
		phase: 'capture',
		status,
		source: { commit: revision, parent: 'b'.repeat(40), tree: 'c'.repeat(40) },
		units: [contract.id],
		tests: ['test/fixture.test.ts'],
		inputs: [{ path: 'test/fixture.test.ts', hash: 'd'.repeat(40) }],
		command: 'fixture class audio',
		assertion: 'Independent evidence capture',
		profile: 'fixture',
		startedAt: '2026-10-25T00:00:00Z',
		finishedAt: '2026-10-25T00:00:01Z',
		exitCode: status === 'passed' ? 0 : 2,
		log: { path: 'output.log', sha256: regressionHash(output), bytes: output.length },
		captures: retained.captures
	};
}

export function sealedAudio(retained: RetainedAudio): SealedAudioFixture {
	const output = Buffer.from('fixture class audio outcome\n');
	const draft = audioRecord(retained);
	const record = { ...draft, id: regressionHash(canonicalJson(draft)) };
	const json = Buffer.from(canonicalJson(record));
	const manifest = Buffer.from(
		canonicalJson({ record: regressionHash(json), log: regressionHash(output) })
	);
	return {
		note: {
			schemaVersion: 1,
			kind: 'regression',
			commit: revision,
			loop: draft.loop,
			phase: 'capture',
			record: record.id,
			evidence: {
				commit: 'e'.repeat(40),
				path: `regressions/${revision}/${record.id}`,
				manifest: regressionHash(manifest)
			}
		},
		files: new Map([
			['record.json', json],
			['output.log', output],
			['manifest.json', manifest],
			...retained.files.map(({ path, bytes }): [string, Buffer] => [path, bytes])
		])
	};
}
