import type { Sign, Recorded } from './artifactMedia.types';

/** True when the bytes hold these values from an offset on; a string stands for its characters. */
const holds =
	(sign: string | number[], offset = 0): Sign =>
	(bytes) => {
		const values = typeof sign === 'string' ? [...sign].map((one) => one.charCodeAt(0)) : sign;
		return values.every((value, index) => bytes[offset + index] === value);
	};

const either =
	(...signs: Sign[]): Sign =>
	(bytes) =>
		signs.some((sign) => sign(bytes));

const png = holds([137, 80, 78, 71, 13, 10, 26, 10]);

const jpeg = holds([0xff, 0xd8, 0xff]);

const frame: Sign = (bytes) => bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;

const wave: Sign = (bytes) => holds('RIFF')(bytes) && holds('WAVE', 8)(bytes);

/** Each audio type a record may state, with what its bytes begin with and what it is served as. */
const audio: Array<{ recorded: string[]; is: Sign; served: string }> = [
	{ recorded: ['audio/wav', 'audio/x-wav', 'audio/wave'], is: wave, served: 'audio/wav' },
	{ recorded: ['audio/mpeg', 'audio/mp3'], is: either(holds('ID3'), frame), served: 'audio/mpeg' },
	{ recorded: ['audio/mp4', 'audio/x-m4a'], is: holds('ftyp', 4), served: 'audio/mp4' },
	{ recorded: ['audio/ogg'], is: holds('OggS'), served: 'audio/ogg' }
];

const results = ['output', 'assertions', 'trace'];

const json = 'application/json';

const plain = 'text/plain; charset=utf-8';

function screenshot(bytes: Uint8Array): string {
	if (png(bytes)) return 'image/png';
	if (jpeg(bytes)) return 'image/jpeg';
	throw new Error(
		'These bytes are not a PNG or JPEG image, so they are not served as a screenshot.'
	);
}

function sound(recorded: string, bytes: Uint8Array): string {
	const known = audio.find((item) => item.recorded.includes(recorded));
	if (!known) throw new Error(`A capture recorded as ${recorded} is not served as audio.`);
	if (known.is(bytes)) return known.served;
	throw new Error(`These bytes are not ${known.served} audio, so they are not served.`);
}

/** Text is read as text and never run: JSON when it was recorded as JSON and is JSON. */
function result(recorded: string, bytes: Uint8Array): string {
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		text = '\0';
	}
	if (text.includes('\0')) throw new Error('This result is not text, so it is not served.');
	if (recorded.split(';')[0].trim() !== json) return plain;
	try {
		JSON.parse(text);
		return json;
	} catch {
		return plain;
	}
}

/**
 * The media type one capture is served with, decided here from its kind and its bytes and from
 * a fixed list; what the record states is believed only where the bytes agree. A screenshot is
 * a PNG or a JPEG, audio is one of the audio types a record may state, a recorded result is
 * JSON or plain text. Nothing is ever HTML or anything a page would run, and what is none of
 * these is refused.
 */
export function artifactMedia(capture: Recorded, bytes: Uint8Array): string {
	if (capture.kind === 'screenshot') return screenshot(bytes);
	if (capture.kind === 'audio') return sound(capture.mediaType, bytes);
	if (results.includes(capture.kind)) return result(capture.mediaType, bytes);
	throw new Error(`A capture of kind ${capture.kind} is not served.`);
}
