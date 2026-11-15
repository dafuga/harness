import { expect, test } from 'vitest';
import { VideoArchiveService } from '../../../src/services/verification-evidence/VideoArchiveService';

test('VideoArchiveService runs', () => {
	expect(new VideoArchiveService().run()).toBe('video-archive');
});
