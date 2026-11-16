import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GameRenderService } from '../../src/lib/development-tooling/desktop-bridge/GameRenderService';

const projectId = 'local-3f9a1c07b2e84d65a0f1c9e7d24b8a635e0d91c4a7f2b836d10e5c9a48f7b2d1';
const request = { projectId, model: 'lucy-restyle-2' as const, fast: false, seconds: 30 };

function failure(promise: Promise<unknown>) {
	return promise.then(
		() => null,
		(error: unknown) =>
			error instanceof Error ? { name: error.name, message: error.message } : String(error)
	);
}

test('Rejects busy sessions and unavailable provider transport', async () => {
	const root = mkdtempSync(join(tmpdir(), 'game-render-'));
	try {
		const session = {
			busy: true,
			assertProject: (id?: string) => expect(id).toBe(projectId),
			mutable: async () => ({ root })
		};
		const busy = await failure(new GameRenderService(session as never).start(request));
		session.busy = false;
		const unavailable = await failure(
			new GameRenderService(session as never, () => false).start(request)
		);
		expect(busy).toEqual({ name: 'GameRenderBusyError', message: 'Wait for the current run.' });
		expect(unavailable).toEqual({
			name: 'CredentialSafeProviderTransportUnavailableError',
			message: 'Live AI is blocked until a credential-safe provider transport is available.'
		});
		recordExampleCases(
			{
				unitId: 'desktop.service.game-render',
				symbol: 'start',
				state: 'rejects-busy-sessions-and-unavailable-provider-transport',
				evidence: 'examples-cases',
				file: 'rejects-busy-sessions-and-unavailable-provider-transport.json'
			},
			[
				{ name: 'Busy project session', input: { request, busy: true }, error: busy },
				{
					name: 'Provider transport unavailable',
					input: { request, busy: false, transportReady: false },
					error: unavailable
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
