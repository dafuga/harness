import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, onTestFinished, test } from 'vitest';
import { TrackerOutgoingDriverAdapter } from '../../../src/adapters/projects-sessions/TrackerOutgoingDriverAdapter';
import type { TrackerOutgoingMessage } from '../../../src/repositories/projects-sessions/TrackerOutgoingDraftRepository.types';

const attempt = '77ecc6dd-7d69-4c9c-9981-2804ecc6f93c';

function fixture(channel: 'sms' | 'imessage' | 'telegram' | 'github-comment' | 'post') {
	const home = mkdtempSync(join(tmpdir(), 'tracker-outgoing-driver-'));
	onTestFinished(() => rmSync(home, { recursive: true, force: true }));
	const driver = join(home, 'driver');
	const captured = join(home, 'captured');
	const reply = join(home, 'reply');
	writeFileSync(
		driver,
		`#!/bin/sh
test "$#" -eq 0 || exit 2
cat > '${captured}'
cat '${reply}'
`
	);
	chmodSync(driver, 0o700);
	const account = 'fixture-sender';
	const destination = 'fixture-destination';
	const adapter = new TrackerOutgoingDriverAdapter({
		account,
		channel,
		destinations: [destination],
		executable: driver,
		receiptOrigins: ['https://fixture.example.test']
	});
	const message: TrackerOutgoingMessage = {
		account,
		channel,
		to: [destination],
		cc: [],
		body: 'Fixture review contains $(literal text)\nand "quoted" words.'
	};
	return { adapter, message, captured, reply };
}

for (const channel of ['sms', 'imessage', 'telegram', 'github-comment', 'post'] as const) {
	test(`the reviewed ${channel} driver receives only the approved request on stdin`, async () => {
		const { adapter, message, captured, reply } = fixture(channel);
		const refused = { ...message, to: ['unexpected-destination'] };
		const result = {
			kind: 'sent',
			receipt: { reference: 'receipt-1', url: 'https://fixture.example.test/receipt' }
		};
		writeFileSync(reply, JSON.stringify(result));
		expect(adapter.matches(message)).toBe(true);
		expect(adapter.matches(refused)).toBe(false);
		expect(adapter.matches({ ...message, account: 'someone-else' })).toBe(false);
		await expect(adapter.send(refused, attempt)).resolves.toEqual({ kind: 'failed' });
		expect(() => readFileSync(captured)).toThrow();
		await expect(adapter.send(message, attempt)).resolves.toEqual(result);
		expect(JSON.parse(readFileSync(captured, 'utf8'))).toEqual({ attempt, message });
	});
}

test('an unknown driver outcome cannot authorize an automatic retry', async () => {
	const { adapter, message, reply } = fixture('post');
	writeFileSync(reply, 'interrupted');
	await expect(adapter.send(message, attempt)).resolves.toEqual({ kind: 'unconfirmed' });
	writeFileSync(
		reply,
		JSON.stringify({
			kind: 'sent',
			receipt: { reference: 'receipt-1', url: 'https://wrong.example.test/receipt' }
		})
	);
	await expect(adapter.send(message, attempt)).resolves.toEqual({
		kind: 'sent',
		receipt: { reference: 'receipt-1' }
	});
	writeFileSync(reply, JSON.stringify({ kind: 'failed' }));
	await expect(adapter.send(message, attempt)).resolves.toEqual({ kind: 'failed' });
});
