import { HostedFailureValidator } from '../../../validators/development-tooling/HostedFailureValidator';
import { hostedResponse } from '../../../utils/development-tooling/hostedResponse';

const codes = new Set([
	'evidence-stale',
	'evidence-unreadable',
	'artifact-refused',
	'artifact-too-large',
	'invalid-evidence-revision',
	'forbidden',
	'not-found',
	'invalid-input',
	'invalid-path',
	'revision-mismatch',
	'unavailable',
	'github-unavailable',
	'repository-denied',
	'artifact-corrupt',
	'blob-integrity',
	'truncated-tree',
	'metadata-too-large',
	'ref-mismatch',
	'cache-hash-mismatch',
	'session-required'
]);

/** Only bounded public codes are repeated; server prose and unknown values never escape. */
export async function hostedPublicFailure(response: Response) {
	let code: unknown;
	try {
		const bytes = await hostedResponse(response, 4096);
		code = JSON.parse(new TextDecoder().decode(bytes)).error;
	} catch {
		code = undefined;
	}
	const error = new HostedFailureValidator(
		[401, 403].includes(response.status) ? 'denied' : 'failed',
		response.status
	);
	error.message =
		typeof code === 'string' && codes.has(code)
			? `The hub refused this read: ${code}.`
			: `The hub refused this read (${response.status}).`;
	return error;
}
