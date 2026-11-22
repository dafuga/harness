import { Command } from 'commander';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import { VaultSealAdapter } from '../../../src/adapters/accounts-access/VaultSealAdapter';
import { CredentialCommand } from '../../../src/commands/accounts-access/CredentialCommand';
import { serveCredentialBroker } from '../../../src/workflows/accounts-access/serveCredentialBroker';
import { FakePhone } from '../../support/credential-vault/phone';
import { reviewed, syntheticRecipe } from '../../support/credential-vault/recipe';
import { createTempDirectory } from '../../support/temporary';

const root = await createTempDirectory('vault-cli-');
let fixtures = 0;
afterAll(() => rmSync(root, { recursive: true, force: true }));

const closers: (() => Promise<void>)[] = [];
afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.all(closers.splice(0).map((close) => close()));
});

function files() {
	const directory = join(root, String(++fixtures));
	mkdirSync(directory);
	const recipe = syntheticRecipe();
	const { review, reviewers } = reviewed(recipe, Date.now() - 1_000);
	const write = (name: string, value: unknown) => {
		writeFileSync(join(directory, name), JSON.stringify(value));
		return join(directory, name);
	};
	return {
		directory,
		recipe: write('recipe.json', recipe),
		review: write('review.json', review),
		reviewers: write('reviewers.json', { reviewers })
	};
}

async function run(args: string[]): Promise<unknown> {
	const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	const program = new Command().exitOverride();
	new CredentialCommand().register(program);
	await program.parseAsync(['node', 'harness', 'credential', ...args]);
	const printed = log.mock.calls.at(-1)?.[0];
	log.mockRestore();
	return JSON.parse(String(printed));
}

test('recipe digest and verify print the grouped digest the phone shows', async () => {
	const paths = files();
	const digest = (await run(['recipe', 'digest', paths.recipe])) as {
		digest: string;
		display: string;
	};
	expect(digest.display).toMatch(/^[0-9a-f]{4}( [0-9a-f]{4}){3}$/u);
	const verified = await run([
		'recipe',
		'verify',
		paths.recipe,
		'--review',
		paths.review,
		'--reviewers',
		paths.reviewers
	]);
	expect(verified).toMatchObject({ site: 'example-console', revision: 3, digest: digest.digest });
});

function requestArgs(
	paths: ReturnType<typeof files>,
	action: string,
	ready: string,
	socket: string
) {
	const runnerKey = new VaultSealAdapter().runnerKey().publicKey;
	return [
		'--socket',
		socket,
		'request',
		paths.recipe,
		action,
		'--review',
		paths.review,
		'--reviewers',
		paths.reviewers,
		'--item',
		'b9e3w0',
		'--session',
		'claude-b9e3w0',
		'--project',
		'harness',
		'--environment',
		'synthetic',
		'--host',
		'mb2',
		'--runner-key',
		runnerKey,
		'--reason',
		'Synthetic check.',
		'--ready',
		ready
	];
}

test('an action with an unready API token is blocked and never becomes a browser login', async () => {
	const paths = files();
	const result = await run(
		requestArgs(paths, 'read-usage', 'browser', join(paths.directory, 'none.sock'))
	);
	expect(result).toEqual({ status: 'blocked', reason: 'The api-token method is not ready.' });
});

test('a browser action is filed with the broker for phone approval', async () => {
	const paths = files();
	const phone = new FakePhone();
	const trust = join(paths.directory, 'trust.json');
	writeFileSync(
		trust,
		JSON.stringify({
			devices: [{ id: phone.deviceId, role: 'approver', signingKey: phone.signingKey }]
		})
	);
	const socket = join(paths.directory, 's', 'broker.sock');
	const served = await serveCredentialBroker({
		socket,
		state: join(paths.directory, 'state'),
		trust,
		origin: 'https://vault.example.test'
	});
	closers.push(served.close);
	const result = await run(requestArgs(paths, 'read-roster', 'browser', socket));
	expect(result).toMatchObject({ status: 'requested', method: 'browser' });
	expect((result as { requestId: string }).requestId).toMatch(/^[0-9a-f]{32}$/u);
});
