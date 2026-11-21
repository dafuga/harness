import { randomUUID } from 'node:crypto';
import { expect, test } from 'vitest';
import { deployFixture } from '../../support/scripted-deploy/fixture';

test('serializes claims per project and environment', async () => {
	const fixture = await deployFixture();
	try {
		const id = randomUUID();
		fixture.store.lock('fixture', 'staging', id);
		expect(() => fixture.store.lock('fixture', 'staging', randomUUID())).toThrow(id);
		fixture.store.lock('fixture', 'preprod', randomUUID());
		expect(fixture.store.active('fixture', 'staging')).toBe(id);
	} finally {
		fixture.dispose();
	}
});
