import { expect, test, vi } from 'vitest';
import { VaultPasswordService } from '../../../src/services/accounts-access/VaultPasswordService';
import { sessionRequest, vaultBroker } from '../../support/credential-vault/broker';
import { signupFixtureRecipe } from '../../support/credential-vault/recipe';

test.each(['completed', 'store-failed', 'form-failed', 'close-failed'] as const)(
	'prepared signup keeps password bytes inside the executor (%s)',
	async (outcome) => {
		const { recipe, script } = signupFixtureRecipe();
		const broker = vaultBroker();
		const scope = { project: 'harness', environment: 'synthetic', host: 'mb2' };
		const request = sessionRequest(broker.seal.runnerKey(), {
			action: 'generate-password',
			mode: 'write',
			recipe: { site: recipe.recipe.site, revision: recipe.recipe.revision, digest: recipe.digest }
		});
		let stored: Buffer | undefined;
		const store = vi.fn(async (bytes: Buffer) => {
			stored = bytes;
			expect(/^Aa1![A-Za-z0-9_-]{32}$/u.test(bytes.toString('ascii'))).toBe(true);
			if (outcome === 'store-failed') throw new Error(bytes.toString('ascii'));
		});
		const submit = vi.fn(async (bytes: Buffer) => {
			expect(bytes === stored).toBe(true);
		});
		const close = vi.fn(async () => {
			if (outcome === 'close-failed') throw new Error('Fixture cleanup failed.');
		});
		const openBrowser = vi.fn(async () => ({
			prepareForm: async () => {
				if (outcome === 'form-failed') throw new Error('Wrong form');
				return submit;
			},
			close
		}));
		const service = new VaultPasswordService({ recipe, script, scope, store, openBrowser });
		expect(service.prepare({ ...request, account: 'wrong-account' })).toBeUndefined();
		expect(openBrowser).not.toHaveBeenCalled();
		const run = service.prepare(request)!;
		const pending = run();
		if (outcome === 'completed') await expect(pending).resolves.toBeUndefined();
		else
			await expect(pending).rejects.toThrow(
				/^(Password generation stopped|Password browser teardown)/u
			);
		expect(close).toHaveBeenCalledTimes(1);
		expect(submit).toHaveBeenCalledTimes(
			Number(outcome === 'completed' || outcome === 'close-failed')
		);
		if (outcome === 'form-failed') expect(store).not.toHaveBeenCalled();
		else expect(stored?.every((byte) => byte === 0)).toBe(true);
	}
);

test('the executor rejects a changed signup script before a request can be prepared', () => {
	const { recipe } = signupFixtureRecipe();
	const scope = { project: 'harness', environment: 'synthetic', host: 'mb2' };
	expect(
		() =>
			new VaultPasswordService({
				recipe,
				scope,
				script: Buffer.from('{}'),
				openBrowser: vi.fn(),
				store: vi.fn()
			})
	).toThrow('reviewed script digest');
});
