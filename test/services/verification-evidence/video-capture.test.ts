import { expect, test } from 'vitest';
import { VideoCaptureService } from '../../../src/services/verification-evidence/VideoCaptureService';

test('VideoCaptureService runs', () => {
	expect(new VideoCaptureService().run()).toBe('video-capture');
});
