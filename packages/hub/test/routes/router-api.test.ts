import { expect, test } from 'vitest';
import { project, unit, commit, projectionFixture } from '../support/projectionFixture';
test('strict threads route passes only its declared contract', async () => {
	const f = projectionFixture();
	const response = await f.controller.handle(
		new Request(
			`https://fixture.example/api/projects/${project.id}/threads?entityId=${unit.id}&commit=${commit}`
		)
	);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual([]);
});
