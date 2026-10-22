import { Buffer } from 'node:buffer';
type ImageFetch = (url: string, options: RequestInit) => Promise<Response>;
/** One explicit image request; authentication stays in the backend header. */
export class GptImageAdapter {
	constructor(private send: ImageFetch = globalThis.fetch) {}
	async generate(key: string, prompt: string): Promise<Buffer> {
		let response: Response;
		try {
			response = await this.send('https://api.openai.com/v1/images/generations', {
				method: 'POST',
				redirect: 'error',
				signal: AbortSignal.timeout(180_000),
				headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: 'gpt-image-2',
					prompt,
					n: 1,
					size: '1536x1024',
					quality: 'medium',
					output_format: 'png'
				})
			});
		} catch {
			throw new Error(
				'Image generation failed. Check this project’s OpenAI configuration. No retry was made.'
			);
		}
		if (!response.ok)
			throw new Error('Image generation failed (HTTP ' + response.status + '). No retry was made.');
		return decodePng(await response.text());
	}
}

function decodePng(payload: string): Buffer {
	if (payload.length > 24_000_000) throw new Error('Generated image exceeds the size limit.');
	let result: { data?: { b64_json?: string }[] };
	try {
		result = JSON.parse(payload) as typeof result;
	} catch {
		throw new Error('Provider did not return a PNG image.');
	}
	const encoded = result.data?.[0]?.b64_json;
	if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
		throw new Error('Provider did not return a PNG image.');
	const bytes = Buffer.from(encoded, 'base64');
	if (bytes.length > 12_000_000 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
		throw new Error('Provider did not return a valid PNG image.');
	return bytes;
}
