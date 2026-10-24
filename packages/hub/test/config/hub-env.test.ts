import { expect, test } from 'vitest';
import { hubEnvConfig } from '../../src/configs/hubEnvConfig';
test('only dedicated project settings enter configuration', () => {
	expect(
		hubEnvConfig({ GOOGLE_CLIENT_ID: 'borrowed', HARNESS_GOOGLE_CLIENT_ID: 'dedicated' })
	).toEqual({ HARNESS_GOOGLE_CLIENT_ID: 'dedicated' });
});
