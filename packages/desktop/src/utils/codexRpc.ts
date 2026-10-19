import { spawn } from 'node:child_process';
import { killOwnedProcess } from './cliProcess';
import { cliEnvironment } from './cliEnvironment';
import type { CliCommand } from '../models/AgentRunner.types';
import { rpcMessages, rpcRequest } from './rpcMessages';
import type { RpcEvent, RpcPending } from './rpcMessages';
import { streamLines } from './streamLines';
function connection(command: CliCommand) {
	const child = spawn(command.command, command.args, {
		env: cliEnvironment(),
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
	child.stdout.on('data', consume.write);
	// Consume diagnostics without exposing raw output or private reasoning to the renderer.
	child.stderr.resume();
	child.on('error', rejectAll);
	child.on('close', () => rejectAll(new Error('Codex connection closed.')));
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
export async function codexRpc(
	command: CliCommand = {
		command: 'codex',
		args: ['app-server', '--stdio', '-c', 'model_provider="openai"']
	}
) {
	const rpc = connection(command);
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
