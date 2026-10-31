import { measureWorkload } from '../../../../test/support/measureWorkload';
import { expect, vi } from 'vitest';
import type { AdmissionCase, UploadPost } from './uploadAdmissionCases.types';
const origin = 'http://127.0.0.1:5588';
const multipart = { Origin: origin, 'Content-Type': 'multipart/form-data' };
/** All three public routes preserve admission order, exact limits and refusal before body access. */
export async function assertUploadAdmission(
	post: UploadPost,
	limit: number,
	failure: string,
	state: string
) {
	await measureWorkload('reports.function.reports-media-admit-upload-request', state, () =>
		measureWorkload('reports.endpoint.api-report-' + state, state, async () => {
			const admitted = [undefined, '', '0', '-1', 'invalid', String(limit - 1), String(limit)].map(
				(size) => ({
					headers: size === undefined ? multipart : { ...multipart, 'Content-Length': size },
					status: failure.startsWith('Cloudflare') ? 502 : 500,
					error: failure,
					reads: 1
				})
			);
			for (const entry of [...rejectedCases(limit), ...admitted])
				await assertAdmission(post, entry);
			// Prefix acceptance is existing policy; malformed multipart content still belongs to parsing.
			await assertAdmission(post, {
				headers: { ...multipart, 'Content-Type': 'multipart/form-data-invalid' },
				status: failure.startsWith('Cloudflare') ? 502 : 500,
				error: failure,
				reads: 1
			});
		})
	);
}

function rejectedCases(limit: number): AdmissionCase[] {
	return [
		{ headers: {}, status: 403, error: 'Same-origin upload required', reads: 0 },
		{
			headers: {
				...multipart,
				Origin: 'https://other.example',
				'Content-Length': String(limit + 1)
			},
			status: 403,
			error: 'Same-origin upload required',
			reads: 0
		},
		{
			headers: {
				Origin: origin,
				'Content-Type': 'application/json',
				'Content-Length': String(limit + 1)
			},
			status: 415,
			error: 'Multipart form required',
			reads: 0
		},
		{
			headers: { ...multipart, 'Content-Type': 'Multipart/form-data' },
			status: 415,
			error: 'Multipart form required',
			reads: 0
		},
		{
			headers: { ...multipart, 'Content-Length': String(limit + 1) },
			status: 413,
			error: 'Upload exceeds size limit',
			reads: 0
		},
		{
			headers: { ...multipart, 'Content-Length': 'Infinity' },
			status: 413,
			error: 'Upload exceeds size limit',
			reads: 0
		}
	];
}

async function assertAdmission(post: UploadPost, entry: AdmissionCase) {
	const request = new Request(origin + '/api/upload-admission-fixture', {
		method: 'POST',
		headers: entry.headers
	});
	const body = vi
		.spyOn(request, 'formData')
		.mockRejectedValue(new Error('Synthetic body parse failure'));
	try {
		const response = await post({ request, url: new URL(request.url) });
		expect(response.status, JSON.stringify(entry.headers)).toBe(entry.status);
		expect(await response.json()).toEqual({ error: entry.error });
		expect(body).toHaveBeenCalledTimes(entry.reads);
		expect(request.bodyUsed).toBe(false);
	} finally {
		body.mockRestore();
	}
}
