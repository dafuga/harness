import type { Source, Shot } from './repository.regression-proof.test.types';
import { regressionHash } from '../../src/utils/git-source-history/regressionHistory';
import type { TemporaryRepo } from '../support/temporary.types';

export const unit = 'repository.regression-proof';

/** The commit, its tree and its parent: the source identity a checkpoint is taken from. */
export function sourceAt(repo: TemporaryRepo, commit: string): Source {
	const tree = repo.git('rev-parse', `${commit}^{tree}`);
	return { commit, tree, parent: repo.git('rev-parse', `${commit}^`) };
}

/** A focused capture of `revision` whose stored bytes are `bytes`. */
export function focusedShot(revision: string, bytes: Buffer): Shot {
	return {
		unit,
		capture: {
			evidence: 'focused-screenshot',
			kind: 'screenshot',
			state: 'focused-proof',
			status: 'passed',
			path: 'focused/shot.png',
			sha256: regressionHash(bytes),
			bytes: bytes.length,
			mediaType: 'image/png',
			capturedAt: '2026-11-14T09:00:02.000Z',
			provenance: 'actual-capture',
			server: { buildId: 'fixture-build', revision }
		}
	};
}
