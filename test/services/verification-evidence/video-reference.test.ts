import { expect, test } from 'vitest';
import { VideoReferenceService } from '../../../src/services/verification-evidence/VideoReferenceService';

test('VideoReferenceService runs', () => {
	expect(new VideoReferenceService().run()).toBe('video-reference');
});
