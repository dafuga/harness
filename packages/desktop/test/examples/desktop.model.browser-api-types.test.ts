import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { Query, BrowserApi, ApiFailure } from '../../src/models/development-tooling/BrowserApi.types';

function createBrowserApi(): BrowserApi {
	return {
		async media(_path: string, _query?: Query) {
			return { bytes: new Uint8Array([1, 2]), mediaType: 'image/png' };
		},
		async get<T>(_path: string, _query?: Query) {
			return { id: 'project-7', name: 'Atlas' } as T;
		},
		async send<T>(_method: 'POST' | 'DELETE', _path: string, _body?: unknown) {
			return { accepted: true } as T;
		},
		async bytes(_path: string, _query?: Query) {
			return new Uint8Array([3, 4]);
		}
	};
}

function createApiFailure(): ApiFailure {
	return Object.assign(new Error('Project not found'), {
		status: 404,
		code: 'project_not_found'
	});
}

test('accepts typed project API requests and responses', async () => {
	const api = createBrowserApi();
	const query: Query = { include: 'members', cursor: null, optional: undefined };
	const project = await api.get<{ id: string; name: string }>('/projects/project-7', query);
	const created = await api.send<{ accepted: boolean }>('POST', '/projects', { name: 'Atlas' });
	const media = await api.media('/projects/project-7/icon', { size: 'small' });
	const bytes = await api.bytes('/projects/export');

	expect(project).toEqual({ id: 'project-7', name: 'Atlas' });
	expect(created.accepted).toBe(true);
	expect(media).toEqual({ bytes: new Uint8Array([1, 2]), mediaType: 'image/png' });
	expect(bytes).toEqual(new Uint8Array([3, 4]));
	recordExampleCases(
		{
			unitId: 'desktop.model.browser-api-types',
			symbol: 'BrowserApi',
			state: 'accepts-typed-project-api-requests-and-responses',
			evidence: 'examples-cases',
			file: 'accepts-typed-project-api-requests-and-responses.json'
		},
		[
			{
				name: 'read project with nullable query values',
				input: { path: '/projects/project-7', query },
				output: project
			},
			{ name: 'post project with caller-chosen response type', input: { method: 'POST', path: '/projects', body: { name: 'Atlas' } }, output: created },
			{ name: 'read media payload', input: { path: '/projects/project-7/icon', query: { size: 'small' } }, output: { byteLength: media.bytes.length, mediaType: media.mediaType } },
			{ name: 'read raw bytes', input: { path: '/projects/export' }, output: { byteLength: bytes.length } }
		]
	);
});

test('accepts an error with request status and code', () => {
	const failure = createApiFailure();
	expect(failure).toBeInstanceOf(Error);
	expect(failure).toMatchObject({ message: 'Project not found', status: 404, code: 'project_not_found' });
	recordExampleCases(
		{
			unitId: 'desktop.model.browser-api-types',
			symbol: 'ApiFailure',
			state: 'accepts-an-error-with-request-status-and-code',
			evidence: 'examples-cases',
			file: 'accepts-an-error-with-request-status-and-code.json'
		},
		[
			{
				name: 'project not found failure',
				input: { message: failure.message, status: failure.status, code: failure.code },
				output: { name: failure.name, message: failure.message, status: failure.status, code: failure.code }
			}
		]
	);
});
