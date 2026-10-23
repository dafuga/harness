import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { ResourceContext } from '../../../../../../src/core/execution-runtimes/resourceTypes';
import { resourceEnvironment } from '../../../../../../src/utils/execution-runtimes/resourceEnvironment';
import type { CliCommand } from '../../../models/agents-providers/AgentRunner.types';
import { cliEnvironment } from '../../development-tooling/cli-environment/cliEnvironment';
import { killOwnedProcess } from '../../development-tooling/cliProcess';
import { streamLines } from '../../development-tooling/streamLines';
import type { RpcEvent, RpcPending } from '../rpcMessages';
import { rpcMessages, rpcRequest } from './rpcMessages';
/** Consumes diagnostics without exposing raw output or private reasoning to the renderer. */
function connection(command: CliCommand, resources?: ResourceContext) {
	const child = spawn(command.command, command.args, {
		env: { ...cliEnvironment(), ...resourceEnvironment(resources?.env ?? {}) },
		detached: process.platform !== 'win32',
		stdio: 'pipe'
	});
	let sequence = 0,
		closed = false;
	const pending = new Map<number, RpcPending>(),
		listeners = new Set<(event: RpcEvent) => void>();
	const send = (value: unknown) => {
		if (closed) throw new Error('Codex connection closed.');
		child.stdin.write(JSON.stringify(value) + '\n');
	};
	const rejectAll = (error: Error) => {
		closed = true;
		pending.forEach((p) => {
			clearTimeout(p.timer);
			p.reject(error);
		});
		pending.clear();
	};
	const consume = streamLines({
		onLine: (line) => rpcMessages({ pending, listeners, send }, line),
		maxBytes: 96000000,
		onOverflow: () => {
			killOwnedProcess(child.pid);
			rejectAll(new Error('Codex message too large.'));
		}
	});
	watchConnection(child, consume, rejectAll);
	if (child.pid) resources?.track(child.pid);
	const request = <T = unknown>(method: string, params: unknown = {}, timeoutMs = 30000) =>
		rpcRequest(
			{ pending, listeners, send },
			{ id: ++sequence, method, params },
			timeoutMs
		) as Promise<T>;
	return {
		send,
		request,
		dispose: () => {
			killOwnedProcess(child.pid);
			rejectAll(new Error('Codex connection closed.'));
			child.stdin.end();
		},
		subscribe: (listener: (event: RpcEvent) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
	};
}

function watchConnection(
	child: ChildProcessWithoutNullStreams,
	consume: ReturnType<typeof streamLines>,
	reject: (error: Error) => void
): void {
	child.stdout.on('data', consume.write);
	child.stderr.resume();
	child.on('error', reject);
	child.on('close', () => reject(new Error('Codex connection closed.')));
	child.stdin.on('error', () => reject(new Error('Codex connection closed.')));
}

export async function codexRpc(
	command: CliCommand = {
		command: 'codex',
		args: ['app-server', '--stdio', '-c', 'model_provider="openai"']
	},
	resources?: ResourceContext
) {
	const rpc = connection(command, resources);
	try {
		await rpc.request('initialize', {
			clientInfo: { name: 'harness-desktop', version: '0.1.0' },
			capabilities: { experimentalApi: true }
		});
		rpc.send({ method: 'initialized' });
		return rpc;
	} catch (error) {
		rpc.dispose();
		throw error;
	}
}
