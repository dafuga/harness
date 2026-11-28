import { expect } from 'vitest';
import { codexComposer, composer } from './trackerSlotFixture';
import type { TrackerSlotFixture } from './trackerSlotFixture.types';

const minute = 60_000;

export async function verifyLiveAnswerDelivery(hub: TrackerSlotFixture) {
	for (const [item, model, prompt] of [
		['liveclaude', 'claude-sonnet-5-5:high', composer()],
		['livecodex0', 'gpt-6.2-sol:medium', codexComposer()]
	]) {
		hub.queue(item, model);
		await hub.advance(5_000);
		await hub.request(`/items/${item}/start`);
		await hub.request(`/items/${item}/flag`, {
			question: 'Choose the synthetic region',
			options: [
				{ label: 'First region', detail: 'Use the first synthetic region' },
				{ label: 'Second region', detail: 'Use the second synthetic region' }
			]
		});
		await hub.request(
			`/items/${item}/answer`,
			item === 'liveclaude' ? { answer: 'Synthetic free text' } : { option: 1 }
		);
		if (item === 'liveclaude') await verifyManualAnswerReceipt(hub, item, prompt);
		await hub.advance(3 * minute);
		expect.soft(hub.runtime.watchdog!.alerts()).toContainEqual(
			expect.objectContaining({
				item_id: item,
				kind: 'answer-delivery'
			})
		);
		const name = hub.panes().find((pane) => pane.startsWith(`auto-${item.slice(0, 6)}-`))!;
		expect(name).toBeDefined();
		hub.screen(name, prompt);
		await hub.advance(minute);
		await hub.advance(minute);
		expect
			.soft(hub.tmuxInput().match(new RegExp(`Tracker answer for item ${item}`, 'g')) ?? [])
			.toHaveLength(1);
		const notes = hub.database.prepare('SELECT text FROM item_notes WHERE item_id = ?').all(item);
		expect
			.soft(notes.map(({ text }) => text))
			.toContainEqual(expect.stringContaining(`delivered to ${name}`));
		await hub.request(`/items/${item}/done`);
		await hub.advance(minute);
	}
}

async function verifyManualAnswerReceipt(hub: TrackerSlotFixture, item: string, prompt: string) {
	const run = hub.database.prepare('SELECT id, tmux FROM runs WHERE item_id = ?').get(item)!;
	const { answered_at } = hub.database
		.prepare('SELECT answered_at FROM items WHERE id = ?')
		.get(item)!;
	const alert = expect.objectContaining({ item_id: item, kind: 'answer-delivery' });
	await hub.advance(3 * minute);
	expect(hub.runtime.watchdog!.alerts()).toContainEqual(alert);
	await hub.request(`/items/${item}/note`, {
		text: `Tracker answer ${answered_at} hand-delivered to run #${run.id} on another-computer.`
	});
	expect(hub.runtime.watchdog!.alerts()).toContainEqual(alert);
	await hub.request(`/items/${item}/note`, {
		text: `Tracker answer ${answered_at} hand-delivered to run #${run.id} on daniel-primary-mbp.`
	});
	expect
		.soft(hub.runtime.watchdog!.alerts(), 'Manual receipt must clear a queued answer alert')
		.not.toContainEqual(alert);
	hub.screen(String(run.tmux), prompt);
	await hub.advance(minute);
	expect
		.soft(hub.tmuxInput(), 'Manual receipt must prevent redelivery')
		.not.toContain(`Tracker answer for item ${item}`);
	hub.screen(String(run.tmux), 'Working (esc to interrupt)');
	await hub.request(`/items/${item}/flag`, { question: 'Choose a replacement synthetic region' });
	await hub.request(`/items/${item}/answer`, { answer: 'A newer answer' });
}
