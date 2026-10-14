import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { actor, commit, project, unit } from '../support/projectionFixture';
import { optionsFixture } from '../support/optionsFixture';

/**
 * The flat images of a version with options are exactly the files its options claim, each once:
 * planning never writes one file twice. A stored version listing an image twice is refused,
 * although every option still claims its own file once. SYNTHETIC planning-written Git files as
 * checked out, with only the flat images of v002 changed before the hub reads them.
 */
test('a version of options listing one flat image twice is refused', async () => {
	const f = await optionsFixture();
	f.change(f.design, (value) => {
		const images = value.images as unknown[];
		return { ...value, images: [...images, images[1]] };
	});
	const read = f.projection.entity(actor, project.id, {
		entityId: unit.id,
		commit,
		branch: 'main'
	});
	await expect(read).rejects.toThrow();
}, 30_000);
