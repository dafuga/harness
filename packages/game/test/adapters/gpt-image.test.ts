import { expect, test, vi } from 'vitest';
import { GptImageAdapter } from '../../src/adapters/GptImageAdapter';
const png =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('GPT Image sends one bounded generation with header auth and decodes PNG', async () => {
	const send = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: png }] })));
	const bytes = await new GptImageAdapter(send).generate(
		'synthetic-project-key',
		'A key beside a stone door'
	);
	expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
	const [url, options] = send.mock.calls[0] as unknown as [string, RequestInit];
	expect(url).toBe('https://api.openai.com/v1/images/generations');
	expect(url).not.toContain('synthetic-project-key');
	expect(options.headers).toMatchObject({ Authorization: 'Bearer synthetic-project-key' });
	expect(JSON.parse(String(options.body))).toMatchObject({
		model: 'gpt-image-2',
		n: 1,
		size: '1536x1024',
		quality: 'medium',
		output_format: 'png'
	});
});
test('provider errors and malformed images fail without retry or leaking provider details', async () => {
	const send = vi.fn(async () => new Response('secret-provider-body', { status: 429 }));
	await expect(new GptImageAdapter(send).generate('synthetic-key', 'scene')).rejects.toThrow(
		'Image generation failed'
	);
	expect(send).toHaveBeenCalledTimes(1);
	const invalid = async () => new Response(JSON.stringify({ data: [{ b64_json: 'SGVsbG8=' }] }));
	await expect(new GptImageAdapter(invalid).generate('synthetic-key', 'scene')).rejects.toThrow(
		'PNG'
	);
});
