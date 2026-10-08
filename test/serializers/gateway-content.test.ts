import { expect, test } from 'vitest';
import { GatewayContentSerializer } from '../../src/serializers/GatewayContentSerializer';
import { ClaudeGatewayAdapter } from '../../src/adapters/ClaudeGatewayAdapter';
import { CodexSessionRepository } from '../../src/repositories/CodexSessionRepository';

const png =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const image = { type: 'input_image', image_url: `data:image/png;base64,${png}` };
const serializer = new GatewayContentSerializer();

test('mixed historical images keep ordering, role and call ownership without mutating input', () => {
	const input = [
		{ role: 'user', content: [image], selection: { x: 2 } },
		{ role: 'assistant', content: 'earlier observation' },
		{
			type: 'function_call_output',
			call_id: 'call-a',
			output: [{ type: 'input_text', text: 'screenshot' }, image]
		}
	];
	const before = JSON.stringify(input);
	const converted = serializer.history(input);
	expect(converted.images).toHaveLength(2);
	expect(JSON.stringify(converted.input)).not.toContain(png);
	expect(converted.input[0]).toMatchObject({
		role: 'user',
		selection: { x: 2 },
		content: [{ image_reference: 1 }]
	});
	expect(converted.input[2]).toMatchObject({
		call_id: 'call-a',
		output: [{ text: 'screenshot' }, { image_reference: 2 }]
	});
	expect(JSON.stringify(input)).toBe(before);
});

test('resource screenshot bytes and error metadata survive a structured tool result', () => {
	const output = {
		isError: true,
		content: [
			{ type: 'resource', resource: { uri: 'fixture://screen', mimeType: 'image/png', blob: png } }
		]
	};
	const result = serializer.toolResult(JSON.stringify(output));
	expect(result.isError).toBe(true);
	expect(result.content[1]).toEqual({ type: 'image', mimeType: 'image/png', data: png });
	expect(JSON.stringify(result.content[0])).toContain('fixture://screen');
	expect(result.content[0]).toMatchObject({
		type: 'text',
		text: expect.stringContaining('image_reference')
	});
});

test('ordinary tool text and JSON retain their exact text representation', () => {
	for (const text of ['one\ntwo', '{ "marker": "value" }', '[]']) {
		expect(serializer.toolResult(text)).toEqual({ content: [{ type: 'text', text }] });
	}
});

test('too many images and excessive content nesting fail explicitly', () => {
	expect(() => serializer.history([{ content: Array.from({ length: 21 }, () => image) }])).toThrow(
		'20 images'
	);
	let nested: unknown = image;
	for (let index = 0; index < 40; index++) nested = { child: nested };
	expect(() => serializer.history([{ content: nested }])).toThrow('nesting');
});

test('invalid screenshot in a parallel batch consumes none of its tool outputs', async () => {
	const repository = new CodexSessionRepository();
	const session = repository.create('batch');
	session.running = true;
	const a = repository.waitForTool(session, 'a');
	const b = repository.waitForTool(session, 'b');
	const input = [
		{ type: 'function_call_output', call_id: 'a', output: 'valid' },
		{ type: 'function_call_output', call_id: 'b', output: [{ ...image, image_url: 'not bytes' }] }
	];
	expect(() =>
		new ClaudeGatewayAdapter(repository).start(
			{ model: 'claude-opus-5-5', stream: true, tools: [], input },
			session
		)
	).toThrow('Image bytes');
	expect([...session.pending.keys()]).toEqual(['a', 'b']);
	expect(session.delivered.size).toBe(0);
	const rejected = Promise.all([
		expect(a).rejects.toThrow('cancelled'),
		expect(b).rejects.toThrow('cancelled')
	]);
	repository.cancel(session);
	await rejected;
});

test('unsupported binary resources and image links cannot silently turn into text', () => {
	for (const block of [
		{ type: 'resource', resource: { mimeType: 'application/pdf', blob: 'synthetic' } },
		{ type: 'resource_link', mimeType: 'image/png', uri: 'https://images.example/one.png' }
	])
		expect(() => serializer.history([{ content: [block] }])).toThrow();
});
