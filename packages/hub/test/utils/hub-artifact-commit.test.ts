import { expect, test } from 'vitest';
import { hubArtifactCommit } from '../../src/services/hub-projection-service/hubArtifactCommit';
import { hubSource } from '../../src/utils/hubSource';
import { actor, project, commit, projectionFixture } from '../support/projectionFixture';

test('multiple recorded writes to a design cannot attest an immutable introduction', async () => {
	const f = projectionFixture();
	f.source.historyPage = async () => ({
		commits: [commit, '9'.repeat(40)].map((hash) => ({
			hash,
			subject: 'feat: design',
			authoredAt: '2026-10-12T00:00:00Z'
		})),
		complete: true,
		nextPage: null
	});
	const context = await hubSource({
		source: f.source,
		cache: f.cache,
		actor,
		project,
		ref: commit
	});
	expect(await hubArtifactCommit(context, 'src/pages/example/designs/v001/design.json')).toBeNull();
});
