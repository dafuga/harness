import { expect, test, vi } from 'vitest';
import { deliverFeature } from '../scripts/deliver-feature/deliverFeature';
import type {
	DeliveryInput,
	DeliveryServices
} from '../scripts/deliver-feature/deliverFeature.types';
import type { TrackerItem } from '../src/repositories/projects-sessions/TrackerItemReadRepository.types';

const item = {
	id: 'delivery01',
	title: 'Project recordings',
	agent: 'harness',
	status: 'in_progress'
} as TrackerItem;
const input: DeliveryInput = {
	id: item.id,
	stage: 'staging',
	note: 'Release proof',
	origin: 'https://hub.example.invalid'
};

function services(overrides: Partial<DeliveryServices> = {}) {
	return {
		readItem: vi.fn(async () => item),
		capture: vi.fn(async () => ({ bytes: Buffer.from('fixture clip'), durationSeconds: 25 })),
		storeVideo: vi.fn<DeliveryServices['storeVideo']>(async () => {}),
		attach: vi.fn<DeliveryServices['attach']>(async () => {}),
		record: vi.fn<DeliveryServices['record']>(async () => {}),
		publish: vi.fn<DeliveryServices['publish']>(async () => {}),
		now: () => new Date('2026-11-28T15:06:00.000Z'),
		...overrides
	};
}

test('records, uploads, attaches, completes, then publishes the delivery', async () => {
	const deps = services();
	const { url, delivery } = await deliverFeature(input, deps);
	expect(delivery).toMatchObject({
		id: item.id,
		stage: 'staging',
		project: 'harness',
		durationSeconds: 25
	});
	expect(deps.storeVideo).toHaveBeenCalledWith(delivery, Buffer.from('fixture clip'));
	expect(deps.attach).toHaveBeenCalledWith(item.id, {
		links: [{ label: 'Feature video · staging', url }]
	});
	expect(deps.record).toHaveBeenCalledWith(
		item.id,
		expect.stringContaining(`Release proof\nFeature video · staging ${url}`),
		true
	);
	expect(deps.publish).toHaveBeenCalledWith(delivery);
	const calls = [deps.capture, deps.storeVideo, deps.attach, deps.record, deps.publish].map(
		(operation) => vi.mocked(operation).mock.invocationCallOrder[0]
	);
	expect(calls).toEqual(calls.slice().sort((a, b) => a - b));
});

test('blocks feature delivery before storing when the video is outside 20–60 seconds', async () => {
	const deps = services({
		capture: async () => ({ bytes: Buffer.from('clip'), durationSeconds: 19.99 })
	});
	await expect(deliverFeature(input, deps)).rejects.toThrow();
	expect(deps.storeVideo).not.toHaveBeenCalled();
	expect(deps.record).not.toHaveBeenCalled();
	expect(deps.publish).not.toHaveBeenCalled();
});

test('does not attach or complete when the private R2 upload fails', async () => {
	const deps = services({
		storeVideo: async () => {
			throw new Error('upload unavailable');
		}
	});
	await expect(deliverFeature(input, deps)).rejects.toThrow('upload unavailable');
	expect(deps.attach).not.toHaveBeenCalled();
	expect(deps.record).not.toHaveBeenCalled();
	expect(deps.publish).not.toHaveBeenCalled();
});

test('does not publish when Tracker refuses completion', async () => {
	const deps = services({
		record: async () => {
			throw new Error('tracker refused');
		}
	});
	await expect(deliverFeature(input, deps)).rejects.toThrow('tracker refused');
	expect(deps.publish).not.toHaveBeenCalled();
});

test('backfills the original date without completing the same item again', async () => {
	const backfillAt = '2026-11-25T14:30:00.000Z';
	const deps = services({ readItem: async () => ({ ...item, status: 'done' }) });
	const { delivery } = await deliverFeature({ ...input, backfillAt }, deps);
	expect(delivery.at).toBe(backfillAt);
	expect(deps.record).toHaveBeenCalledWith(item.id, expect.any(String), false);
});
