import { expect, test, vi } from 'vitest';
import { SealedEnrollmentReviewService } from '../../../src/services/networking-security/SealedEnrollmentReviewService';
import { sealedDevice } from '../../../src/utils/networking-security/sealedDevice';

test('an unreviewed mailbox cannot ask for local approval', async () => {
	const request = vi.fn(),
		confirm = vi.fn();
	const options = {
		account: 'fixture',
		device: await sealedDevice(),
		pin: { seq: 0, head: '0'.repeat(64) },
		signal: new AbortController().signal,
		request
	};
	const review = new SealedEnrollmentReviewService(options, '1'.repeat(32));
	await expect(review.approve('123456', confirm)).rejects.toThrow();
	expect(confirm).not.toHaveBeenCalled();
	expect(request).not.toHaveBeenCalled();
});
