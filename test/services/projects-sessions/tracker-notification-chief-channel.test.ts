import { expect, test } from 'vitest';
import { chief, notificationFixture, owner } from './tracker-notification/fixture';

/** Hub messages for Chief of Staff use the digest's destination, keyed by the message id. */
const message = { id: 'abcdefghij-1a2b3c4d', itemId: 'abcdefghij', text: 'Message from Daniel' };

test('the hub sends a Chief of Staff message to the digest destination with a stable idempotency id', async () => {
	const f = notificationFixture();
	const channel = f.service.chiefChannel();
	expect(channel).toBeDefined();
	const sent = await channel!.send(message);
	expect(sent).toEqual({ attempt: `hub_message|${message.id}`, result: { status: 'sent' } });
	expect(f.calls).toHaveLength(1);
	const [request] = f.calls;
	expect(request).toMatchObject({
		id: `hub_message|${message.id}`,
		destination: chief,
		headers: { 'x-tracker-event': 'hub_message' }
	});
	expect(JSON.parse(request.body)).toMatchObject({
		event: 'hub_message',
		to: 'chief_of_staff',
		message_id: message.id,
		item_id: message.itemId,
		text: message.text,
		node: 'fixture-node'
	});
});

test('the Chief of Staff callback is used when the hub has no digest destination', async () => {
	const f = notificationFixture({ options: { webhook: undefined, chiefOfStaff: owner } });
	await f.service.chiefChannel()!.send(message);
	expect(f.calls.map((call) => call.destination)).toEqual([owner]);
});

test('a spoke, or a hub whose destinations are unavailable, has no Chief of Staff channel', () => {
	expect(
		notificationFixture({ options: { role: 'spoke' } }).service.chiefChannel()
	).toBeUndefined();
	const unavailable = notificationFixture();
	unavailable.options.destinations.available = () => false;
	expect(unavailable.restart().chiefChannel()).toBeUndefined();
	expect(
		notificationFixture({ options: { webhook: undefined } }).service.chiefChannel()
	).toBeUndefined();
});
