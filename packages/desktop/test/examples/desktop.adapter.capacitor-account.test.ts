import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { CapacitorAccountAdapter } from '../../src/lib/verification-evidence/select-environment/capacitor-account-adapter/CapacitorAccountAdapter';
import {
	decoded,
	failure,
	fields,
	json,
	plain,
	refusal,
	refused
} from '../../src/lib/verification-evidence/select-environment/capacitor-account-adapter/capacitorAccountCodec';
import type {
	AccountNativeCall,
	AccountNativePlugin,
	AccountNativeStatus
} from '../../src/models/development-tooling/Environment.types';
import './desktop.adapter.capacitor-account.cases';

function errorResult(error: Error & { status: number; code: string }) {
	return { status: error.status, code: error.code, message: error.message };
}

test('normalizes native plugin and Hub refusals', () => {
	const supplied = failure(413, 'too-large', 'The reply is too large for this phone.');
	const pluginCause = { code: 'session-required', message: 'Sign in is required.' };
	const pluginError = refusal(pluginCause);
	const hubReply = {
		status: 403,
		contentType: 'application/json',
		data: btoa(JSON.stringify({ error: 'forbidden' }))
	};
	const hubError = refused(hubReply);

	expect(errorResult(supplied)).toEqual({
		status: 413,
		code: 'too-large',
		message: 'The reply is too large for this phone.'
	});
	expect(errorResult(pluginError)).toEqual({
		status: 401,
		code: 'session-required',
		message: 'Sign in is required.'
	});
	expect(errorResult(hubError)).toMatchObject({ status: 403, code: 'forbidden' });
	// prettier-ignore
	recordExampleCases({ unitId: 'desktop.adapter.capacitor-account', symbol: 'refusal', state: 'normalizes-native-plugin-and-hub-refusals', evidence: 'examples-cases', file: 'normalizes-native-plugin-and-hub-refusals.json' }, [
		{ name: 'retain an explicit public failure', input: { status: 413, code: 'too-large', message: supplied.message }, output: errorResult(supplied) },
		{ name: 'map a native session refusal', input: pluginCause, output: errorResult(pluginError) },
		{ name: 'read a public code from a Hub refusal', input: hubReply, output: errorResult(hubError) }
	]);
});

test('decodes bounded native replies as JSON', () => {
	const encodedText = 'SGVsbG8=';
	const text = new TextDecoder().decode(decoded(encodedText, 5));
	const reply = {
		status: 200,
		contentType: 'application/json',
		data: btoa(JSON.stringify({ ok: true }))
	};
	const parsed = json<{ ok: boolean }>(reply);

	expect(text).toBe('Hello');
	expect(parsed).toEqual({ ok: true });
	// prettier-ignore
	recordExampleCases({ unitId: 'desktop.adapter.capacitor-account', symbol: 'json', state: 'decodes-bounded-native-replies-as-json', evidence: 'examples-cases', file: 'decodes-bounded-native-replies-as-json.json' }, [
		{ name: 'decode an answer within its byte limit', input: { data: encodedText, limit: 5 }, output: text },
		{ name: 'parse a native JSON reply', input: reply, output: parsed }
	]);
});

test('normalizes Hub query fields and request bodies', () => {
	const query = { page: '2', state: 'open', empty: '' };
	const projectFields = fields(query);
	const body = { title: 'Site visit', count: 2 };
	const plainBody = plain(body);
	const emptyBody = plain(null);

	expect(projectFields).toEqual({ page: '2', state: 'open' });
	expect(plainBody).toEqual(body);
	expect(emptyBody).toEqual({});
	// prettier-ignore
	recordExampleCases({ unitId: 'desktop.adapter.capacitor-account', symbol: 'fields', state: 'normalizes-hub-query-fields-and-request-bodies', evidence: 'examples-cases', file: 'normalizes-hub-query-fields-and-request-bodies.json' }, [
		{ name: 'omit an empty read field', input: query, output: projectFields },
		{ name: 'preserve a plain JSON body', input: body, output: plainBody },
		{ name: 'replace a null request body', input: null, output: emptyBody }
	]);
});

test('connects the phone account to shared project reads', async () => {
	const signedOutStatus: AccountNativeStatus = {
		configured: true,
		state: 'signed-out'
	};
	const signedOut = { ...signedOutStatus, credential: 'native-fixture-only' };
	const signedInStatus: AccountNativeStatus = {
		configured: true,
		state: 'signed-in',
		actor: { id: 'hub-user-42', name: 'Jordan Lee', email: 'jordan@example.com' }
	};
	const signedIn = { ...signedInStatus, credential: 'native-fixture-only' };
	let currentStatus: AccountNativeStatus = signedOut;
	const nativeCalls: AccountNativeCall[] = [];
	const accessEvents: Array<{ projectId: string; status: string }> = [];
	const plugin: AccountNativePlugin = {
		status: async () => currentStatus,
		connect: async () => (currentStatus = signedIn),
		disconnect: async () => (currentStatus = signedOut),
		request: async (call) => {
			nativeCalls.push(call);
			return {
				status: 200,
				contentType: 'application/json',
				data: btoa(JSON.stringify([{ id: 'project-cedar', name: 'Cedar planning' }]))
			};
		}
	};
	const bridge = new CapacitorAccountAdapter({ plugin }).connect();
	bridge.onCacheStatus?.((event) => accessEvents.push(event));
	const initialStatus = await bridge.hostedStatus!();
	const connectedStatus = await bridge.connectHosted!();
	const projects = await bridge.listProjects!();
	const disconnectedStatus = await bridge.disconnectHosted!();
	const denied = accessEvents.map((event) => event.status);

	expect(initialStatus).toEqual({ configured: true, state: 'signed-out' });
	expect(connectedStatus).toEqual({ configured: true, state: 'signed-in', actor: signedIn.actor });
	expect(projects).toEqual([{ id: 'project-cedar', name: 'Cedar planning', kind: 'shared' }]);
	expect(nativeCalls).toEqual([{ method: 'GET', path: '/api/projects', query: {} }]);
	expect(disconnectedStatus).toEqual({ configured: true, state: 'signed-out' });
	expect(denied).toEqual(['denied']);
	// prettier-ignore
	recordExampleCases({ unitId: 'desktop.adapter.capacitor-account', symbol: 'connect', state: 'connects-the-phone-account-to-shared-project-reads', evidence: 'examples-cases', file: 'connects-the-phone-account-to-shared-project-reads.json' }, [
		{ name: 'read the signed-out native account', input: { operation: 'hostedStatus' }, output: initialStatus },
		{ name: 'connect the native account', input: { operation: 'connectHosted' }, output: connectedStatus },
		{ name: 'list shared projects through the signed-in phone account', input: { operation: 'listProjects' }, output: { projects, nativeCall: nativeCalls[0] } },
		{ name: 'disconnect and deny prior project access', input: { operation: 'disconnectHosted' }, output: { status: disconnectedStatus, denied } }
	]);
});

test('clears a phone account after an unauthorized project read', async () => {
	const signedIn = {
		configured: true,
		state: 'signed-in',
		actor: { id: 'hub-user-42', name: 'Jordan Lee', email: 'jordan@example.com' }
	} satisfies AccountNativeStatus;
	let currentStatus: AccountNativeStatus = signedIn;
	const accessStatuses: string[] = [];
	const plugin: AccountNativePlugin = {
		status: async () => currentStatus,
		connect: async () => signedIn,
		disconnect: async () => ({ configured: true, state: 'signed-out' }),
		request: async () => {
			currentStatus = { configured: true, state: 'signed-out' };
			return {
				status: 401,
				contentType: 'application/json',
				data: btoa(JSON.stringify({ error: 'session-required' }))
			};
		}
	};
	const bridge = new CapacitorAccountAdapter({ plugin }).connect();
	bridge.onCacheStatus?.((event) => accessStatuses.push(event.status));
	const projects = await bridge.listProjects!();
	const status = await bridge.hostedStatus!();

	expect(projects).toEqual([]);
	expect(status).toEqual({ configured: true, state: 'signed-out' });
	expect(accessStatuses).toEqual(['denied']);
	// prettier-ignore
	recordExampleCases({ unitId: 'desktop.adapter.capacitor-account', symbol: 'connect', state: 'clears-a-phone-account-after-an-unauthorized-project-read', evidence: 'examples-cases', file: 'clears-a-phone-account-after-an-unauthorized-project-read.json' }, [
		{ name: 'clear an unauthorized account and return no projects', input: { operation: 'listProjects' }, output: { projects, status, accessStatuses } }
	]);
});
