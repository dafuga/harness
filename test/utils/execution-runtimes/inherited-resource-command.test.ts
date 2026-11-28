import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ResourceContext } from '../../../src/core/execution-runtimes/resourceTypes';
import { resourceCommand } from '../../../src/utils/execution-runtimes/resourceCommand';
import { runIsolated } from '../../../src/utils/reports-media/run-isolated/runIsolated';
import type * as RunIsolatedModule from '../../../src/utils/reports-media/run-isolated/runIsolated';
import { createTempDirectory } from '../../support/temporary';

vi.mock('../../../src/utils/reports-media/run-isolated/runIsolated', async (importOriginal) => {
	const actual = await importOriginal<typeof RunIsolatedModule>();
	return { ...actual, runIsolated: vi.fn(actual.runIsolated) };
});

let home: string;
beforeEach(async () => {
	home = await createTempDirectory('inherited-command-');
});
afterEach(() => {
	vi.mocked(runIsolated).mockClear();
	rmSync(home, { recursive: true, force: true });
});

function inheritedContext(track: (pid: number) => void = () => undefined): ResourceContext {
	return {
		id: 'parent-lease',
		env: { HARNESS_RESOURCES_HOME: home, PATH: '/usr/bin:/bin' },
		track,
		inherited: true
	};
}

const node = (code: number) => [process.execPath, '-e', `process.exit(${code})`];

test('inherited work runs its command directly and resolves the exit status', async () => {
	const track = vi.fn();
	const context = inheritedContext(track);
	expect(await resourceCommand(node(0), context)).toBe(0);
	expect(await resourceCommand(node(3), context)).toBe(3);
	expect(runIsolated).not.toHaveBeenCalled();
	expect(track).not.toHaveBeenCalled();
	expect(existsSync(join(context.env.HARNESS_RESOURCES_HOME!, 'logs'))).toBe(false);
});

test('inherited work passes the lease environment to its command', async () => {
	const context = inheritedContext();
	context.env = { ...context.env, HARNESS_RESOURCE_LEASE: 'parent-lease' };
	const check = 'process.exit(process.env.HARNESS_RESOURCE_LEASE === "parent-lease" ? 0 : 4)';
	expect(await resourceCommand([process.execPath, '-e', check], context)).toBe(0);
});

test('inherited work with a missing executable rejects', async () => {
	await expect(
		resourceCommand(['/nonexistent/harness-missing-binary'], inheritedContext())
	).rejects.toMatchObject({ code: 'ENOENT' });
	expect(runIsolated).not.toHaveBeenCalled();
});

test('leased work outside a sandbox still goes through the isolated runner', async () => {
	const context = { ...inheritedContext(), inherited: false };
	expect(await resourceCommand(node(0), context)).toBe(0);
	expect(runIsolated).toHaveBeenCalledOnce();
});
