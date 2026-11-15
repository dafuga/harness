import { expect, test } from 'vitest';
import { FrameFlagService } from '../../../src/services/verification-evidence/FrameFlagService';

test('FrameFlagService runs', () => {
	expect(new FrameFlagService().run()).toBe('frame-flag');
});
