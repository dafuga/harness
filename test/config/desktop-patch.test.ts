import { expect, test } from 'vitest';
import { desktopPatchConfig } from '../../src/configs/development-tooling/desktopPatchConfig';

test('desktop patch is pinned to the inspected installed build', () => {
	expect(desktopPatchConfig.version).toBe('26.1002.52244');
});
