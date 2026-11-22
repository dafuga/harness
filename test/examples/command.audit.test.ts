import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command, CommanderError } from 'commander';
import { test, vi } from 'vitest';
import { registerAuditCommand } from '../../src/cli/program/audit';
import { ExpectedCliError } from '../../src/core/development-tooling/errors';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * Registered as buildProgram registers it, so the action runs only when commander dispatches to it.
 * Help and refused options stop in commander; a dispatch on a temporary directory reaches runAudit,
 * which falls back to HARNESS_ANALYTICS_* for unset analytics options, so those are blanked there.
 */

/** Stands in for the temporary directory in recorded inputs, so no case records a machine path. */
const scrubbed = '<temporary directory>';

/** A program named as buildProgram names it: output is captured and exits are thrown, not made. */
function harnessProgram(written: { stdout: string[]; stderr: string[] }): Command {
	return new Command()
		.name('harness')
		.exitOverride()
		.configureOutput({
			writeOut: (text) => written.stdout.push(text),
			writeErr: (text) => written.stderr.push(text),
			getOutHelpWidth: () => 120
		});
}

/** Registers the audit command on a fresh program that already holds the named commands. */
function registerOn(existing: string[]) {
	const root = harnessProgram({ stdout: [], stderr: [] });
	for (const name of existing) root.command(name);
	return { root, returned: registerAuditCommand(root) };
}

/** The audit subcommand as its callers read it: its name, arguments and options with defaults. */
function auditOf(root: Command) {
	const found = root.commands.find((command) => command.name() === 'audit');
	if (!found) throw new Error('registerAuditCommand added no audit command');
	return {
		name: found.name(),
		description: found.description(),
		arguments: found.registeredArguments.map((argument) => ({
			name: argument.name(),
			required: argument.required
		})),
		options: found.options.map(({ flags, defaultValue }) => ({ flags, default: defaultValue }))
	};
}

/** What registration left behind: the return value, the program's commands and the audit command. */
function outcomeOf({ root, returned }: { root: Command; returned: unknown }) {
	return {
		returned: String(returned),
		programCommands: root.commands.map((command) => command.name()),
		audit: auditOf(root)
	};
}

/**
 * Parses argv against a fresh program that holds the audit command. Returns what commander printed,
 * what the action printed through console.log, and the error the parse ended with, if any.
 */
async function run(argv: string[]) {
	const written: { stdout: string[]; stderr: string[] } = { stdout: [], stderr: [] };
	const root = harnessProgram(written);
	registerAuditCommand(root);
	const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	let error: unknown;
	let logged: string[] = [];
	try {
		await root.parseAsync(argv, { from: 'user' });
	} catch (thrown) {
		error = thrown;
	} finally {
		logged = log.mock.calls.map((call) => String(call[0]));
		log.mockRestore();
	}
	return { written, logged, error };
}

/** A recorded case whose call returned the output. */
function answered(name: string, input: unknown, output: unknown) {
	return { name, input, output };
}

/** A recorded case whose call was refused with the error. */
function refused(name: string, input: unknown, error: unknown) {
	return { name, input, error };
}

/** A failure as a recorded value: commander's code and exit status, or the error's name and message. */
function failure(error: unknown): Record<string, unknown> {
	if (error instanceof CommanderError)
		return { code: error.code, exitCode: error.exitCode, message: error.message };
	if (error instanceof Error) return { name: error.name, message: error.message };
	return { value: String(error) };
}

/** The option lines of a help page, as a caller reads them. */
function optionLines(written: { stdout: string[] }): string[] {
	return written.stdout
		.join('')
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.startsWith('-'));
}

/** Four dispatches over a directory holding one TypeScript file, with the analytics variables blanked. */
async function auditedDirectory(directory: string) {
	mkdirSync(join(directory, 'src'));
	writeFileSync(join(directory, 'src', 'example.ts'), 'export const value = 1;\n');
	for (const name of ['LOOP', 'STEP', 'TASK', 'REPORT'])
		vi.stubEnv(`HARNESS_ANALYTICS_${name}`, '');
	const exitCode = process.exitCode;
	try {
		const text = await run(['audit', directory]);
		const json = await run(['audit', directory, '--json']);
		const coverage = await run(['audit', directory, '--coverage']);
		const unsupported = await run(['audit', directory, '--profile', 'nope']);
		return { text, json, coverage, unsupported, exitCode: process.exitCode };
	} finally {
		vi.unstubAllEnvs();
		process.exitCode = exitCode;
	}
}

/** Records one state's cases. The state id is also the name of the state's capture file. */
function record(state: string, cases: Parameters<typeof recordExampleCases>[1]) {
	const unit = {
		unitId: 'command.audit',
		symbol: 'registerAuditCommand',
		evidence: 'examples-cases'
	};
	return recordExampleCases({ ...unit, state, file: `${state}.json` }, cases);
}

test('registerAuditCommand added the audit command and its options', () => {
	const alone = registerOn([]);
	const beside = registerOn(['status']);
	const audit = auditOf(alone.root);
	expect(alone.returned).toBeUndefined();
	expect(beside.returned).toBeUndefined();
	expect(audit.description).toBe(
		'Audit Harness rules and optionally review Clean Code principles with Jev.'
	);
	expect(audit.arguments).toEqual([{ name: 'path', required: false }]);
	expect(audit.options.map((option) => option.flags).join(' ')).toBe(
		'--loop <name> --step <id> --task <id> --agent-model <name> --report <id> --coverage --profile <profile> --json --clean-code --gate --dry-run --refresh'
	);
	expect(audit.options).toContainEqual({ flags: '--profile <profile>', default: 'auto' });
	expect(outcomeOf(beside).programCommands).toEqual(['status', 'audit']);
	record('registerauditcommand-added-the-audit-command-and-its-options', [
		answered('harness with no other commands', { existing: [] }, outcomeOf(alone)),
		answered('harness with a status command', { existing: ['status'] }, outcomeOf(beside))
	]);
});

test('commander stopped help and refused options before runAudit', async () => {
	const help = await run(['audit', '--help']);
	const missing = await run(['audit', '--profile']);
	const unknown = await run(['audit', '--bogus']);
	expect(help.error).toMatchObject({ code: 'commander.helpDisplayed', exitCode: 0 });
	expect(help.written.stdout.join('')).toMatch(
		/--profile <profile>\s+Audit profile: auto, app, dapp, or lib\. \(default: "auto"\)/
	);
	expect(missing.error).toMatchObject({
		code: 'commander.optionMissingArgument',
		message: "error: option '--profile <profile>' argument missing"
	});
	expect(unknown.error).toMatchObject({
		code: 'commander.unknownOption',
		message: "error: unknown option '--bogus'"
	});
	expect([help, missing, unknown].map((attempt) => attempt.logged)).toEqual([[], [], []]);
	const helpOutput = { code: 'commander.helpDisplayed', options: optionLines(help.written) };
	record('commander-stopped-help-and-refused-options-before-runaudit', [
		answered('audit --help', ['audit', '--help'], helpOutput),
		refused('audit --profile with no value', ['audit', '--profile'], failure(missing.error)),
		refused('audit with an unknown option', ['audit', '--bogus'], failure(unknown.error))
	]);
});

test('audit on a temp directory ran runAudit and printed the audit', async () => {
	await withTempDir('harness-audit-command-', async (directory) => {
		const { text, json, coverage, unsupported, exitCode } = await auditedDirectory(directory);
		const result = JSON.parse(json.logged.join('\n'));
		expect(text.error ?? json.error ?? coverage.error).toBeUndefined();
		expect(unsupported.error).toBeInstanceOf(ExpectedCliError);
		expect(result.findings).toMatchObject([
			{ path: 'src/example.ts', rule: 'harness-source-structure' }
		]);
		expect(result.coverage.coveredFiles).toEqual(['src/example.ts']);
		expect(coverage.logged.join('\n')).toContain('src/example.ts');
		expect(exitCode).toBe(1);
		const summary = {
			profile: result.coverage.profile,
			findings: result.findings,
			coveredFiles: result.coverage.coveredFiles
		};
		record('audit-on-a-temp-directory-ran-runaudit-and-printed-the-audit', [
			answered('audit prints the findings text', ['audit', scrubbed], { printed: text.logged }),
			answered('audit --json', ['audit', scrubbed, '--json'], summary),
			answered('audit --coverage', ['audit', scrubbed, '--coverage'], { printed: coverage.logged }),
			refused(
				'audit --profile nope',
				['audit', scrubbed, '--profile', 'nope'],
				failure(unsupported.error)
			)
		]);
	});
});
