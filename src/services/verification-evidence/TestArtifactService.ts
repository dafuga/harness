import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { captureLineSchema } from '../../core/verification-evidence/verifyTypes';
import { mediaFacts } from '../../utils/verification-evidence/mediaFacts';
import { recordCapture } from '../../utils/reports-media/record-capture/recordCapture';
import type { Environment } from '../../utils/reports-media/record-capture/recordCapture.types';
import type { TestArtifact } from './TestArtifactService.types';
import { unitIdPattern } from '../../core/development-tooling/unitTypes';

/** Keep generated audio, its transcript and exact bytes even when its owning test later fails. */
export class TestArtifactService {
	constructor(private readonly env: Environment = process.env) {}
	capture(input: TestArtifact) {
		const facts = this.audio(input);
		const sha256 = createHash('sha256').update(input.bytes).digest('hex');
		const line = captureLineSchema.parse({
			evidence: input.evidence,
			state: input.state,
			kind: 'audio',
			file: input.file,
			mediaType: 'audio/wav',
			provenance: input.provenance,
			transcript: input.transcript,
			durationSeconds: facts.durationSeconds,
			note: JSON.stringify({
				unit: input.unit,
				case: input.case,
				revision: this.env.HARNESS_VERIFY_REVISION ?? null,
				sha256
			})
		});
		const directory =
			this.env.HARNESS_EVIDENCE_DIR ?? join(process.cwd(), '.cache/harness/test-artifacts');
		if (!line.file.endsWith('.wav')) throw new Error('Audio artifacts require a WAV filename');
		line.file = line.file.slice(0, -4) + '-' + sha256 + '.wav';
		recordCapture(line, input.bytes, {
			...this.env,
			HARNESS_EVIDENCE_DIR: directory,
			TAKE_SCREENSHOT: '1'
		});
		return { file: line.file, sha256, durationSeconds: facts.durationSeconds };
	}
	private audio(input: TestArtifact) {
		if (typeof input.unit !== 'string' || !unitIdPattern.test(input.unit))
			throw new Error('Audio artifacts require a registered unit identity');
		if (typeof input.case !== 'string' || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(input.case))
			throw new Error('Audio artifacts require a stable case identity');
		if (!['fixture', 'actual-capture'].includes(input.provenance))
			throw new Error('Audio artifacts require explicit provenance');
		if (!input.transcript.trim())
			throw new Error(
				'Audio artifacts require a transcript, including an explicit no-speech description.'
			);
		const facts = mediaFacts(Buffer.from(input.bytes), 'audio/wav');
		if ('error' in facts) throw new Error(`Invalid audio artifact: ${facts.error}`);
		if (facts.kind !== 'audio') throw new Error('Expected audio artifact');
		return facts;
	}
}
export type { TestArtifact } from './TestArtifactService.types';
