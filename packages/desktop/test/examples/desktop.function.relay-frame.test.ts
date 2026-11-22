import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { relayFrame } from '../../src/services/networking-security/remote-host-service/relay-link-service/relayFrame';

const ackText = (ok: unknown) => JSON.stringify({ type: 'ack', ref: 'frame-1', ok });

const oversizedText = () => '{"type":"ack","ref":"' + 'a'.repeat(2_000_000) + '","ok":true}';

test('Accepts a valid ack frame', () => {
	const text = ackText(true);
	const frame = relayFrame(text);

	expect(frame).toEqual({ type: 'ack', ref: 'frame-1', ok: true });

	recordExampleCases(
		{
			unitId: 'desktop.function.relay-frame',
			symbol: 'relayFrame',
			state: 'accepts-a-valid-ack-frame',
			evidence: 'examples-cases',
			file: 'accepts-a-valid-ack-frame.json'
		},
		[{ name: 'ack with ok true is returned as parsed', input: text, output: frame }]
	);
});

test('Rejects an ack whose ok flag is not a boolean', () => {
	const text = ackText('yes');
	const frame = relayFrame(text);

	expect(frame).toBeNull();

	recordExampleCases(
		{
			unitId: 'desktop.function.relay-frame',
			symbol: 'relayFrame',
			state: 'rejects-an-ack-whose-ok-flag-is-not-a-boolean',
			evidence: 'examples-cases',
			file: 'rejects-an-ack-whose-ok-flag-is-not-a-boolean.json'
		},
		[{ name: 'ack with a string ok flag returns null', input: text, output: frame }]
	);
});

test('Rejects invalid JSON and unrecognized frame types', () => {
	const inputs = ['{not json', '{"type":"unknown-kind"}', '{"ref":"frame-1"}'];
	const outputs = inputs.map((text) => relayFrame(text));

	expect(outputs).toEqual([null, null, null]);

	recordExampleCases(
		{
			unitId: 'desktop.function.relay-frame',
			symbol: 'relayFrame',
			state: 'rejects-invalid-json-and-unrecognized-frame-types',
			evidence: 'examples-cases',
			file: 'rejects-invalid-json-and-unrecognized-frame-types.json'
		},
		[
			{ name: 'malformed JSON returns null', input: inputs[0], output: outputs[0] },
			{ name: 'unknown frame type returns null', input: inputs[1], output: outputs[1] },
			{ name: 'missing frame type returns null', input: inputs[2], output: outputs[2] }
		]
	);
});

test('Rejects text longer than the frame size limit', () => {
	const text = oversizedText();
	const frame = relayFrame(text);

	expect(frame).toBeNull();

	recordExampleCases(
		{
			unitId: 'desktop.function.relay-frame',
			symbol: 'relayFrame',
			state: 'rejects-text-longer-than-the-frame-size-limit',
			evidence: 'examples-cases',
			file: 'rejects-text-longer-than-the-frame-size-limit.json'
		},
		[
			{
				name: 'over-limit ack text returns null before parsing',
				input: { length: text.length, type: 'ack' },
				output: frame
			}
		]
	);
});

test('Rejects a device-open frame with a malformed device id', () => {
	const text = JSON.stringify({ type: 'device-open', deviceId: 'not a device id!', connectionId: 'c-1' });
	const frame = relayFrame(text);

	expect(frame).toBeNull();

	recordExampleCases(
		{
			unitId: 'desktop.function.relay-frame',
			symbol: 'relayFrame',
			state: 'rejects-a-device-open-frame-with-a-malformed-device-id',
			evidence: 'examples-cases',
			file: 'rejects-a-device-open-frame-with-a-malformed-device-id.json'
		},
		[{ name: 'device-open with a malformed device id returns null', input: text, output: frame }]
	);
});
