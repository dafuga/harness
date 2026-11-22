// @harness-uid u_yga4vj5ueo
import { spawn, type ChildProcess } from 'node:child_process';
import { constants } from 'node:os';
import type { Command } from 'commander';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import type { RunHarborSdkTool, ScaffoldArguments } from './HarborInspectionCommand.types';
import { installedEntry, nodeExecutable, runtimeEnv } from './harborRunProfiles';

const MCP_CANCEL_GRACE_MS = 1500;
const MCP_LAUNCH_FAILURE = 'Could not start the Harbor SDK MCP session.';

// Adds SDK app-development commands to the existing `harbor` group; the SDK owns all bundle logic.
export function registerHarborAppTools(harbor: Command, run: RunHarborSdkTool): void {
	harbor
		.command('templates')
		.description('List Harbor SDK app templates.')
		.action(() => run(['templates'], 'tool'));
	harbor
		.command('scaffold <template> <dir> [id] [name]')
		.description('Create a Harbor app from an SDK template.')
		.option('--mobile', 'Include the mobile target.')
		.action((...[template, dir, id, name, options]: ScaffoldArguments) => {
			const fields = [template, dir];
			if (id !== undefined) fields.push(id);
			if (name !== undefined) fields.push(name);
			const flags = options.mobile ? ['--mobile'] : [];
			const args = fields.some((field) => field.startsWith('-'))
				? [...flags, '--', ...fields]
				: [...fields, ...flags];
			return run(['scaffold', ...args], 'scaffold');
		});
	harbor
		.command('check [dir]')
		.description('Check a Harbor app with the installed SDK.')
		.action((dir: string | undefined) =>
			run(['check', ...(dir === undefined ? [] : [dir])], 'tool')
		);
	harbor
		.command('pack [dir] [output]')
		.description('Pack a Harbor app with the installed SDK.')
		.action((dir: string | undefined, output: string | undefined) => {
			const args = ['pack'];
			if (dir !== undefined) args.push(dir);
			if (output !== undefined) args.push(output);
			return run(args, 'tool');
		});
	harbor
		.command('stage-android <bundle> <dir>')
		.description('Stage a packed Harbor app for Android with the installed SDK.')
		.action((bundle: string, dir: string) => run(['stage-android', bundle, dir], 'tool'));
	harbor
		.command('mcp <workspace>')
		.description('Serve the installed Harbor SDK MCP over stdio for a workspace.')
		.allowExcessArguments(false)
		.action((workspace: string) => streamHarborMcp(workspace));
}

// Streams the SDK's unbuffered MCP session: inherited stdio, fixed argv, no shell, no timeout.
async function streamHarborMcp(workspace: string): Promise<void> {
	const entry = installedEntry(true);
	const node = nodeExecutable();
	const child = spawn(node, [entry, 'mcp', workspace], {
		env: runtimeEnv('tool', node),
		stdio: 'inherit',
		shell: false,
		windowsHide: true
	});
	process.exitCode = await waitForStream(child);
}

// Cancels only the direct SDK child; resolves with its exit code, or 130/143 after a cancellation.
function waitForStream(child: ChildProcess): Promise<number> {
	return new Promise((resolveExit, reject) => {
		let cancelledWith: number | undefined;
		let grace: ReturnType<typeof setTimeout> | undefined;
		const cancel = (signal: 'SIGINT' | 'SIGTERM', exitCode: number) => {
			if (cancelledWith !== undefined) return;
			cancelledWith = exitCode;
			child.kill(signal);
			grace = setTimeout(() => child.kill('SIGKILL'), MCP_CANCEL_GRACE_MS);
		};
		const onInterrupt = () => cancel('SIGINT', 130);
		const onTerminate = () => cancel('SIGTERM', 143);
		const settle = (action: () => void) => {
			process.off('SIGINT', onInterrupt);
			process.off('SIGTERM', onTerminate);
			clearTimeout(grace);
			action();
		};
		process.on('SIGINT', onInterrupt);
		process.on('SIGTERM', onTerminate);
		child.on('error', () => {
			// A signal error after spawn leaves the child to close normally.
			if (child.pid === undefined) settle(() => reject(new ExpectedCliError(MCP_LAUNCH_FAILURE)));
		});
		child.once('close', (code, signal) =>
			settle(() => resolveExit(cancelledWith ?? code ?? signalExitCode(signal)))
		);
	});
}

function signalExitCode(signal: keyof typeof constants.signals | null): number {
	const signalNumber = signal === null ? undefined : constants.signals[signal];
	return signalNumber === undefined ? 1 : 128 + signalNumber;
}
