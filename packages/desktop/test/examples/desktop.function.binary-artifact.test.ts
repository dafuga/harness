import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { binaryArtifact } from '../../src/utils/reports-media/binaryArtifact';
import { InvalidMediaTypeError } from '../../src/utils/reports-media/binaryArtifact.types';

type Input = Parameters<typeof binaryArtifact>[0];
type Output = Awaited<ReturnType<typeof binaryArtifact>>;

const EMPTY_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const HELLO_SHA = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

const empty: Input = {
	encoding: 'base64',
	data: '',
	byteLength: 0,
	sha256: EMPTY_SHA,
	mediaType: 'application/octet-stream'
} as Input;

const hello: Input = {
	encoding: 'base64',
	data: 'aGVsbG8=',
	byteLength: 5,
	sha256: HELLO_SHA,
	mediaType: 'text/plain'
} as Input;

function summarise(result: Output) {
	return { bytes: Array.from(result.bytes), mediaType: result.mediaType, sha256: result.sha256 };
}

async function rejectionOf(value: Input): Promise<Error> {
	try {
		await binaryArtifact(value);
	} catch (error) {
		if (error instanceof Error) return error;
		throw error;
	}
	throw new Error('Expected binaryArtifact to reject.');
}

test('Decodes an empty transported artifact', async () => {
	const emptyResult = await binaryArtifact(empty);
	const helloResult = await binaryArtifact(hello);

	expect(emptyResult.bytes).toEqual(new Uint8Array(0));
	expect(emptyResult).toMatchObject({ mediaType: 'application/octet-stream', sha256: EMPTY_SHA });
	expect(Array.from(helloResult.bytes)).toEqual([104, 101, 108, 108, 111]);
	expect(helloResult).toMatchObject({ mediaType: 'text/plain', sha256: HELLO_SHA });

	recordExampleCases(
		{
			unitId: 'desktop.function.binary-artifact',
			symbol: 'binaryArtifact',
			state: 'decodes-an-empty-transported-artifact',
			evidence: 'examples-cases',
			file: 'decodes-an-empty-transported-artifact.json'
		},
		[
			{
				name: 'empty artifact with octet-stream media type',
				input: empty,
				output: summarise(emptyResult)
			},
			{
				name: 'hello text artifact decoded to five bytes',
				input: hello,
				output: summarise(helloResult)
			}
		]
	);
});

test('Refuses a media type that is not a string', async () => {
	const input = { ...hello, mediaType: 42 } as unknown as Input;
	const error = await rejectionOf(input);

	expect(error).toBeInstanceOf(InvalidMediaTypeError);
	expect(error).toMatchObject({ message: 'The computer sent media this app cannot read.' });

	recordExampleCases(
		{
			unitId: 'desktop.function.binary-artifact',
			symbol: 'binaryArtifact',
			state: 'refuses-a-media-type-that-is-not-a-string',
			evidence: 'examples-cases',
			file: 'refuses-a-media-type-that-is-not-a-string.json'
		},
		[
			{
				name: 'numeric media type is unreadable',
				input,
				error: { name: error.name, message: error.message }
			}
		]
	);
});

test('Refuses bytes that differ from the sent digest', async () => {
	const wrongDigest = { ...hello, sha256: EMPTY_SHA };
	const wrongLength = { ...hello, byteLength: 4 };
	const digestError = await rejectionOf(wrongDigest);
	const lengthError = await rejectionOf(wrongLength);

	expect(digestError).toMatchObject({ message: 'The media arrived damaged and is not shown.' });
	expect(lengthError).toMatchObject({ message: 'The media arrived damaged and is not shown.' });

	recordExampleCases(
		{
			unitId: 'desktop.function.binary-artifact',
			symbol: 'binaryArtifact',
			state: 'refuses-bytes-that-differ-from-the-sent-digest',
			evidence: 'examples-cases',
			file: 'refuses-bytes-that-differ-from-the-sent-digest.json'
		},
		[
			{
				name: 'digest of another payload is damaged',
				input: wrongDigest,
				error: { name: digestError.name, message: digestError.message }
			},
			{
				name: 'byte length short of the decoded bytes is damaged',
				input: wrongLength,
				error: { name: lengthError.name, message: lengthError.message }
			}
		]
	);
});
