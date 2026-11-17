import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, test, vi } from 'vitest';
import { registerCodexCommand } from '../../src/cli/program/CodexCommand';
import { ExpectedCliError } from '../../src/core/development-tooling/errors';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * registerCodexCommand is called on a program the way buildProgram calls it. The `codex serve`
 * action runs only when commander dispatches to it, so the serve states parse argv on a fresh
 * program. Token files live in withTempDir directories. Bun.serve is replaced by a recording stub
 * so that no port is opened; the rest of the action runs as shipped.
 */

type Served = { hostname: string; port: number; fetch: (request: Request) => Promise<Response> };

const unitId = 'command.codex';
const symbol = 'registerCodexCommand';
const evidence = 'examples-cases';
/** A made-up token of 40 characters: long enough for the length check, never a real credential. */
const ownerToken = 'synthetic-gateway-token-0123456789abcdef';
const ownerFile = `${ownerToken}\n`;

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

/** Records one state's cases under its id, in the evidence file named for that id. */
function recordState(state: string, cases: Parameters<typeof recordExampleCases>[1]): void {
	recordExampleCases({ unitId, symbol, state, evidence, file: `${state}.json` }, cases);
}

/** The value `codex serve` rejects with for these arguments, or undefined when it resolves. */
function outcomeOf(args: string[]): Promise<unknown> {
	const root = new Command('harness').exitOverride();
	registerCodexCommand(root);
	const argv = ['codex', 'serve', ...args];
	return root.parseAsync(argv, { from: 'user' }).then(
		() => undefined,
		(error: unknown) => error
	);
}

/** A rejection as plain values; a temporary directory in its message is shown as a placeholder. */
function failure(error: unknown, directory?: string) {
	const { name, message, code, syscall } = error as Error & { code?: string; syscall?: string };
	const shown = directory ? message.replaceAll(directory, '<temporary directory>') : message;
	return { name, message: shown, code, syscall };
}

/** The names of commands, in order. */
function namesOf(commands: readonly Command[]): string[] {
	return commands.map((command) => command.name());
}

/** A subcommand's name and options: flags, the mandatory marker where set, and the default. */
function summaryOf(command: Command) {
	const options = command.options.map((option) => ({
		flags: option.flags,
		mandatory: option.mandatory || undefined,
		default: option.defaultValue
	}));
	return { name: command.name(), options };
}

/** Writes a token file with exactly the given permission bits, which is what the check reads. */
function tokenFile(directory: string, name: string, contents: string, mode: number): string {
	const path = join(directory, name);
	writeFileSync(path, contents);
	chmodSync(path, mode);
	return path;
}

/** Replaces the Bun global so no port opens: each Bun.serve call is recorded, then answered. */
function stubServe(answer: () => { url: URL }) {
	const serve = vi.fn((_options: Served) => answer());
	vi.stubGlobal('Bun', { serve });
	return serve;
}

test('registerCodexCommand added codex with its serve and picker subcommands, then returned nothing', () => {
	const program = new Command('harness').exitOverride();
	program.command('activity');
	const returned = registerCodexCommand(program);
	const [, codex] = program.commands;
	const [serve, picker, preview] = codex.commands.map(summaryOf);
	expect(returned).toBeUndefined();
	expect(namesOf(program.commands)).toEqual(['activity', 'codex']);
	expect(codex.description()).toBe('Local experimental Codex compatibility gateway.');
	expect(namesOf(codex.commands)).toEqual(['serve', 'picker-mcp', 'picker-preview']);
	expect(serve.options).toEqual([
		{ flags: '--token-file <path>', mandatory: true },
		{ flags: '--port <port>', default: '47831' }
	]);
	expect(picker.options).toEqual([{ flags: '--panel-file <path>', mandatory: true }]);
	expect(preview.options).toEqual([
		{ flags: '--panel-file <path>', mandatory: true },
		{ flags: '--port <port>', default: '47839' }
	]);
	recordState('registercodexcommand-added-codex-with-its-serve-and-picker-s', [
		{
			name: 'a harness program that already has an activity command',
			input: { program: 'harness', existing: ['activity'] },
			output: {
				returnedType: typeof returned,
				description: codex.description(),
				commands: namesOf(program.commands),
				subcommands: [serve, picker, preview]
			}
		}
	]);
});

test('codex serve refused a token file with group or other permission bits, without echoing the token', async () => {
	await withTempDir('codex-command-examples-', async (directory) => {
		const world = tokenFile(directory, 'token-0644', ownerFile, 0o644);
		const group = tokenFile(directory, 'token-0640', ownerFile, 0o640);
		const worldError = await outcomeOf(['--token-file', world]);
		const groupError = await outcomeOf(['--token-file', group]);
		expect(worldError).toBeInstanceOf(ExpectedCliError);
		expect(groupError).toBeInstanceOf(ExpectedCliError);
		expect(failure(worldError).message).toBe('Token file must have owner-only permissions');
		expect(failure(groupError).message).toBe('Token file must have owner-only permissions');
		expect(failure(worldError).message).not.toContain(ownerToken);
		recordState('codex-serve-refused-a-token-file-with-group-or-other-permiss', [
			{
				name: 'a token file with mode 0644, which every local user can read',
				input: { tokenFile: 'token-0644', mode: '0644', contents: ownerFile },
				error: failure(worldError)
			},
			{
				name: 'a token file with mode 0640, which its group can read',
				input: { tokenFile: 'token-0640', mode: '0640', contents: ownerFile },
				error: failure(groupError)
			}
		]);
	});
});

test('codex serve refused a gateway token shorter than 32 characters after trimming whitespace', async () => {
	await withTempDir('codex-command-examples-', async (directory) => {
		const shortFile = 'synthetic-gateway-token-0123456\n'; // 31 characters before the newline
		const paddedFile = '    synthetic-gateway-token    \n'; // 23 characters once trimmed
		const short = tokenFile(directory, 'token-short', shortFile, 0o600);
		const padded = tokenFile(directory, 'token-padded', paddedFile, 0o600);
		const shortError = await outcomeOf(['--token-file', short]);
		const paddedError = await outcomeOf(['--token-file', padded]);
		const refusal = 'Gateway token must contain at least 32 characters';
		expect(shortError).toBeInstanceOf(ExpectedCliError);
		expect(paddedError).toBeInstanceOf(ExpectedCliError);
		expect(failure(shortError).message).toBe(refusal);
		expect(failure(paddedError).message).toBe(refusal);
		recordState('codex-serve-refused-a-gateway-token-shorter-than-32-characte', [
			{
				name: 'a 31 character token in a file with mode 0600',
				input: { tokenFile: 'token-short', mode: '0600', contents: shortFile },
				error: failure(shortError)
			},
			{
				name: 'a 23 character token padded with four spaces on each side',
				input: { tokenFile: 'token-padded', mode: '0600', contents: paddedFile },
				error: failure(paddedError)
			}
		]);
	});
});

test('codex serve let a missing or unreadable token path reject with its system error unchanged', async () => {
	await withTempDir('codex-command-examples-', async (directory) => {
		const missing = await outcomeOf(['--token-file', join(directory, 'missing-token')]);
		const unreadable = await outcomeOf(['--token-file', directory]);
		const shown = (error: unknown) => failure(error, directory);
		expect(shown(missing)).toMatchObject({ name: 'Error', code: 'ENOENT', syscall: 'stat' });
		expect(shown(unreadable)).toMatchObject({ name: 'Error', code: 'EISDIR', syscall: 'read' });
		recordState('codex-serve-let-a-missing-or-unreadable-token-path-reject-wi', [
			{
				name: 'a token path with no file behind it',
				input: { tokenFile: 'missing-token' },
				error: shown(missing)
			},
			{
				name: 'a token path that is a directory: stat accepts it, reading it fails',
				input: { tokenFile: '<temporary directory>', mode: '0700' },
				error: shown(unreadable)
			}
		]);
	});
});

test('codex serve let a listen failure from Bun.serve reject unchanged, using the --port given', async () => {
	await withTempDir('codex-command-examples-', async (directory) => {
		const path = tokenFile(directory, 'token', ownerFile, 0o600);
		const listenError = new Error('listen EADDRINUSE: address already in use 127.0.0.1:47840');
		const serve = stubServe(() => {
			throw listenError;
		});
		const error = await outcomeOf(['--token-file', path, '--port', '47840']);
		expect(error).toBe(listenError);
		expect(serve.mock.calls[0][0]).toMatchObject({ hostname: '127.0.0.1', port: 47840 });
		recordState('codex-serve-let-a-listen-failure-from-bun-serve-reject-uncha', [
			{
				name: 'an owner-only token with --port 47840, a port another process already holds',
				input: { tokenFile: 'token', mode: '0600', contents: ownerFile, port: '47840' },
				error: failure(error)
			}
		]);
	});
});

test('codex serve with an owner-only token asked Bun.serve for 127.0.0.1:47831 and accepted the trimmed token', async () => {
	await withTempDir('codex-command-examples-', async (directory) => {
		const contents = `  ${ownerToken}\n`;
		const path = tokenFile(directory, 'token', contents, 0o600);
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		const serve = stubServe(() => ({ url: new URL('http://127.0.0.1:47831/') }));
		expect(await outcomeOf(['--token-file', path])).toBeUndefined();
		expect(serve).toHaveBeenCalledTimes(1);
		const served = serve.mock.calls[0][0];
		const { hostname, port } = served;
		const url = 'http://127.0.0.1:47831/healthz';
		const authorization = { authorization: `Bearer ${ownerToken}` };
		const healthy = await served.fetch(new Request(url, { headers: authorization }));
		const body: unknown = await healthy.json();
		const printed = log.mock.calls.map(([line]) => line);
		expect({ hostname, port }).toEqual({ hostname: '127.0.0.1', port: 47831 });
		expect(printed).toEqual(['Experimental Codex gateway listening at http://127.0.0.1:47831/']);
		expect(healthy.status).toBe(200);
		expect(body).toMatchObject({ status: 'ok' });
		recordState('codex-serve-with-an-owner-only-token-asked-bun-serve-for-127', [
			{
				name: 'an owner-only token file with spaces and a newline around the token, no --port',
				input: { tokenFile: 'token', mode: '0600', contents },
				output: { printed, served: { hostname, port }, healthz: { status: healthy.status, body } }
			}
		]);
	});
});
