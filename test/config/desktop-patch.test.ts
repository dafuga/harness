import { expect, test } from 'vitest';
import { desktopPatchConfig } from '../../src/config/desktopPatchConfig';

test('desktop patch is pinned to the inspected installed build', () => {
	expect(desktopPatchConfig.version).toBe('26.1002.52244');
});
