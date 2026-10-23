import type { Fixture, Region, Option } from './hub-design-region.test.types';
import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { actor, commit, project, unit } from '../support/projectionFixture';
import { optionsFixture } from '../support/optionsFixture';
const entity = (f: Fixture) =>
	f.projection.entity(actor, project.id, { entityId: unit.id, commit, branch: 'main' });
function stored(region: Region, f: Fixture) {
	f.change(f.design, (value) => ({
		...value,
		revises: { ...(value.revises as Record<string, unknown>), region }
	}));
	return f;
}

test('a revision rectangle reaching the right and bottom edges is kept exactly', async () => {
	const region = { x: 0.25, y: 0.5, width: 0.75, height: 0.5 };
	const f = stored(region, await optionsFixture());
	const source = (f.stored.versions[0].options as unknown as Option[])[1].images[0];
	expect((await entity(f)).versions[1].revises).toEqual({
		...{ version: 'v001', imageSha256: source.sha256, region },
		...{ threadId: null, option: 'o2' }
	});
}, 30_000);

test.each([
	['has no width', { x: 0.1, y: 0.1, width: 0, height: 0.2 }],
	['has no height', { x: 0.1, y: 0.1, width: 0.2, height: 0 }],
	['passes the right edge', { x: 0.6, y: 0.1, width: 0.5, height: 0.2 }],
	['passes the bottom edge', { x: 0.1, y: 0.7, width: 0.2, height: 0.4 }]
])(
	'a revision rectangle that %s is refused',
	async (_name, region) => {
		const f = stored(region, await optionsFixture());
		await expect(entity(f)).rejects.toThrow();
	},
	30_000
);
