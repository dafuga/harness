import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { ProviderSwitchService } from '../../src/services/agents-providers/ProviderSwitchService';
import { ProviderSwitchOperationError } from '../../src/services/agents-providers/ProviderSwitchService.types';
import type { ProviderSelection } from '../../src/core/development-tooling/pickerModelTypes';
import type { SwitchRequest, SwitchStore } from '../../src/core/development-tooling/pickerTypes';
import {
	desktopControlUnavailable,
	switchRevision
} from '../../src/core/development-tooling/pickerTypes';

const UNIT = 'service.provider-switch';
const SESSION = 'session_42';
const TARGET: ProviderSelection = { provider: 'openai', model: 'catalog-model', effort: 'medium' };
const MODELS = [
	{
		provider: 'openai' as const,
		model: 'catalog-model',
		label: 'Catalog model',
		efforts: ['medium'],
		defaultEffort: 'medium',
		source: 'local-catalog' as const
	}
];
const CATALOG = { list: async () => MODELS };
const ATTEMPTS: Record<string, ProviderSelection> = {
	'unlisted effort': { ...TARGET, effort: 'high' },
	'unlisted provider': { ...TARGET, provider: 'harness-claude' }
};

/** A file-backed store: one JSON file per session inside the temporary directory. */
function fileStore(directory: string): SwitchStore {
	const pathFor = (sessionId: string) => join(directory, `${sessionId}.json`);
	const read = (sessionId: string): SwitchRequest | null => {
		const file = pathFor(sessionId);
		return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as SwitchRequest) : null;
	};
	return {
		get: read,
		put(record, expectedId) {
			if (switchRevision(read(record.sessionId)) !== expectedId) return false;
			writeFileSync(pathFor(record.sessionId), JSON.stringify(record));
			return true;
		},
		list: () =>
			readdirSync(directory).map(
				(name) => JSON.parse(readFileSync(join(directory, name), 'utf8')) as SwitchRequest
			)
	};
}

async function captureError(run: () => Promise<unknown>): Promise<Error> {
	try {
		await run();
	} catch (caught) {
		return caught as Error;
	}
	return new Error('no error was thrown');
}

function meta(symbol: string, state: string) {
	return { unitId: UNIT, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

test('Queues a catalog-validated request as pending', async () => {
	await withTempDir('provider-switch-queue-', async (directory) => {
		const store = fileStore(directory);
		const service = new ProviderSwitchService(store, CATALOG);
		const snapshot = await service.request(SESSION, TARGET);

		expect(snapshot.request?.status).toBe('pending');
		expect(snapshot.request?.target).toEqual(TARGET);
		expect(snapshot.controlConnected).toBe(false);
		expect(store.get(SESSION)?.status).toBe('pending');
		recordExampleCases(meta('request', 'queues-a-catalog-validated-request-as-pending'), [
			{
				name: 'catalog-listed openai selection is stored as pending',
				input: { sessionId: SESSION, target: TARGET },
				output: {
					status: snapshot.request?.status,
					target: snapshot.request?.target,
					controlConnected: snapshot.controlConnected
				}
			}
		]);
	});
});

test('Rejects selections outside the configured catalog', async () => {
	await withTempDir('provider-switch-reject-', async (directory) => {
		const service = new ProviderSwitchService(fileStore(directory), CATALOG);
		const errors = await Promise.all(
			Object.entries(ATTEMPTS).map(async ([name, target]) => ({
				name,
				target,
				error: await captureError(() => service.request(SESSION, target))
			}))
		);

		for (const { error } of errors) {
			expect(error).toBeInstanceOf(ProviderSwitchOperationError);
			expect(error.message).toContain('not in the configured model catalog');
		}
		recordExampleCases(
			meta('request', 'rejects-selections-outside-the-configured-catalog'),
			errors.map(({ name, target, error }) => ({
				name: `${name} is rejected before anything is stored`,
				input: { sessionId: SESSION, target },
				error: { name: error.name, message: error.message }
			}))
		);
	});
});

test('Cancels only the current pending request', async () => {
	await withTempDir('provider-switch-cancel-', async (directory) => {
		const service = new ProviderSwitchService(fileStore(directory), CATALOG);
		const queued = await service.request(SESSION, TARGET);
		const requestId = queued.request?.id ?? '';
		const cancelled = await service.cancel(SESSION, requestId);
		const stale = await captureError(() => service.cancel(SESSION, requestId));

		expect(cancelled.request?.status).toBe('cancelled');
		expect(cancelled.request?.reason).toBe('Cancelled by the user.');
		expect(stale).toBeInstanceOf(ProviderSwitchOperationError);
		expect(stale.message).toContain('refresh first');
		recordExampleCases(meta('cancel', 'cancels-only-the-current-pending-request'), [
			{
				name: 'pending request is marked cancelled by the user',
				input: { sessionId: SESSION, requestId: 'current pending id' },
				output: { status: cancelled.request?.status, reason: cancelled.request?.reason }
			},
			{
				name: 'repeating the cancel on a no-longer-pending request is rejected',
				input: { sessionId: SESSION, requestId: 'same id again' },
				error: { name: stale.name, message: stale.message }
			}
		]);
	});
});

test('Reports unavailable desktop control in status', async () => {
	await withTempDir('provider-switch-status-', async (directory) => {
		const service = new ProviderSwitchService(fileStore(directory), CATALOG);
		const snapshot = await service.status(null);
		const sessionSnapshot = await service.status(SESSION);

		expect(snapshot.sessionId).toBeNull();
		expect(snapshot.active).toBeNull();
		expect(snapshot.controlConnected).toBe(false);
		expect(snapshot.message).toBe(desktopControlUnavailable);
		expect(sessionSnapshot.request).toBeNull();
		expect(sessionSnapshot.models).toHaveLength(1);
		recordExampleCases(meta('status', 'reports-unavailable-desktop-control-in-status'), [
			{
				name: 'status without a session reports no control and the unavailable message',
				input: { sessionId: null },
				output: {
					defaultProvider: snapshot.defaultProvider,
					active: snapshot.active,
					controlConnected: snapshot.controlConnected,
					message: snapshot.message
				}
			},
			{
				name: 'status for a session with no stored request has a null request',
				input: { sessionId: SESSION },
				output: {
					sessionId: sessionSnapshot.sessionId,
					request: sessionSnapshot.request,
					modelCount: sessionSnapshot.models.length
				}
			}
		]);
	});
});
