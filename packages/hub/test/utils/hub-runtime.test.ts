import { expect, test } from 'vitest';
import { hubRuntime } from '../../src/routes/api/[...path]/-server/hubRuntime';
test('unconfigured host authenticates nobody and never invents a repository', async () => {
	const runtime = hubRuntime({}),
		request = new Request('https://fixture.example/api/auth/status');
	expect(await runtime.auth.actor(request)).toBeNull();
	expect(await (await runtime.auth.handle(request))?.json()).toEqual({
		actor: null,
		configured: false,
		clientId: null
	});
	expect(() => runtime.connect()).toThrow();
});
