import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { deploymentCommand } from '../../src/utils/projects-sessions/deploymentCommand';
import { DeploymentCommandError } from '../../src/utils/projects-sessions/deploymentCommand.types';

const FAKE_CLI = [
	"const mode = process.argv[2];",
	"if (mode === 'fail') { process.stderr.write('token=example-value'); process.exit(3); }",
	"process.stdout.write('Checked ' + process.env.NODE_ENV + ' CI=' + process.env.CI + '\\n');"
].join('\n');

const FAKE_NAME = 'fake-cli.cjs';
const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A temporary project folder holding a small fake executable script. */
function fixture(): string {
	const dir = mkdtempSync(join(tmpdir(), 'deploy-command-'));
	dirs.push(dir);
	writeFileSync(join(dir, FAKE_NAME), FAKE_CLI);
	return dir;
}

/** Replaces machine-specific paths so recorded cases stay stable. */
function redact(text: string, cwd: string): string {
	return text.split(cwd).join('<temp>').split(process.execPath).join('<node>');
}

/** Resolves to the rejection reason, or undefined when the promise resolves. */
async function caught(promise: Promise<string>): Promise<unknown> {
	try {
		await promise;
		return undefined;
	} catch (error) {
		return error;
	}
}

test('Resolves with stdout and forces CI for the step', async () => {
	const cwd = fixture();
	const command = {
		args: [process.execPath, join(cwd, FAKE_NAME), 'ok'],
		cwd,
		env: { CI: 'false', NODE_ENV: 'production' }
	};

	const output = await deploymentCommand(command);

	expect(output).toBe('Checked production CI=true\n');

	recordExampleCases(
		{
			unitId: 'desktop.function.deployment-command',
			symbol: 'deploymentCommand',
			state: 'resolves-with-stdout-and-forces-ci-for-the-step',
			evidence: 'examples-cases',
			file: 'resolves-with-stdout-and-forces-ci-for-the-step.json'
		},
		[
			{
				name: 'stdout with CI forced to true over an env override',
				input: {
					args: ['<node>', FAKE_NAME, 'ok'],
					cwd: '<temp>',
					env: { CI: 'false', NODE_ENV: 'production' }
				},
				output
			}
		]
	);
});

test('Rejects with the failed step and exit code without stderr', async () => {
	const cwd = fixture();
	const args = [process.execPath, join(cwd, FAKE_NAME), 'fail'];

	const thrown = await caught(deploymentCommand({ args, cwd }));

	expect(thrown).toBeInstanceOf(DeploymentCommandError);
	const message = (thrown as Error).message;
	expect(message).toBe(`Deployment step ${args.join(' ')} failed (3).`);
	expect(message).not.toContain('example-value');

	recordExampleCases(
		{
			unitId: 'desktop.function.deployment-command',
			symbol: 'deploymentCommand',
			state: 'rejects-with-the-failed-step-and-exit-code-without-stderr',
			evidence: 'examples-cases',
			file: 'rejects-with-the-failed-step-and-exit-code-without-stderr.json'
		},
		[
			{
				name: 'non-zero exit reports the step and code, not stderr',
				input: { args: ['<node>', FAKE_NAME, 'fail'], cwd: '<temp>' },
				error: {
					name: (thrown as Error).name,
					message: redact(message, cwd)
				}
			}
		]
	);
});

test('Rejects when the deployment executable cannot start', async () => {
	const cwd = fixture();
	const args = [join(cwd, 'missing-binary'), 'run', 'check'];

	const thrown = await caught(deploymentCommand({ args, cwd }));

	expect(thrown).toBeInstanceOf(Error);
	expect(thrown).toMatchObject({ message: 'Deployment command could not start.' });

	recordExampleCases(
		{
			unitId: 'desktop.function.deployment-command',
			symbol: 'deploymentCommand',
			state: 'rejects-when-the-deployment-executable-cannot-start',
			evidence: 'examples-cases',
			file: 'rejects-when-the-deployment-executable-cannot-start.json'
		},
		[
			{
				name: 'missing executable reports that the command could not start',
				input: { args: ['<temp>/missing-binary', 'run', 'check'], cwd: '<temp>' },
				error: {
					name: (thrown as Error).name,
					message: (thrown as Error).message
				}
			}
		]
	);
});
