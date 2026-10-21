import type { Miniflare } from 'miniflare';
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { PerformanceProfileService } from '../../../../src/services/PerformanceProfileService';
import {
	evidenceRequested,
	recordCapture
} from '../../../../src/utils/record-capture/recordCapture';

export interface WorkerWorkload {
	units: readonly string[];
	workload: string;
}

/** The real shared Worker operation runs once; its inspector is outside the timed operation. */
export async function relayProfile<T>(
	fixture: Miniflare,
	input: WorkerWorkload,
	operation: () => Promise<T>
): Promise<T> {
	if (!evidenceRequested()) return operation();
	if (!input.units.length) throw new Error('Name the Worker units exercised by this operation.');
	let value: T;
	const measurements = await new PerformanceProfileService().measure(
		{ unit: input.units[0], workload: input.workload, rounds: 1, iterations: 1, warmups: 0 },
		async () => {
			value = await operation();
		}
	);
	measurements[0].metric = 'latency-worker-roundtrip-ms';
	measurements[0].method +=
		' One actual local Worker request or socket exchange, including client and transport overhead; shared path cost, without isolated-unit attribution.';
	measurements[1] = {
		...measurements[1],
		metric: 'memory-bytes',
		value: await workerHeap(fixture),
		method:
			'Workerd Runtime.getHeapUsage usedSize after the actual operation. Whole relay Worker isolate including shared code and other fixture objects; not Node runner memory, incremental allocation, isolated-unit memory or peak RSS.'
	};
	const file = 'worker-profile-' + randomUUID() + '.json';
	recordCapture(
		{
			evidence: 'worker-profiles',
			kind: 'benchmark',
			state: 'local-worker',
			file,
			mediaType: 'application/json'
		},
		JSON.stringify({
			measurements: input.units.flatMap((unit) => measurements.map((item) => ({ ...item, unit })))
		})
	);
	return value!;
}

async function workerHeap(fixture: Miniflare): Promise<number> {
	const inspector = await fixture.getInspectorURL();
	inspector.protocol = 'http:';
	const response = await fetch(new URL('/json/list', inspector), {
		signal: AbortSignal.timeout(5000)
	});
	if (!response.ok) throw new Error('The local Worker inspector is unavailable.');
	const targets = (await response.json()) as Array<{ id: string; webSocketDebuggerUrl: string }>;
	const relay = targets.find((target) => target.id === 'core:user:relay');
	if (!relay) throw new Error('The relay Worker inspector target is missing.');
	return inspectorHeap(relay.webSocketDebuggerUrl);
}

async function inspectorHeap(address: string): Promise<number> {
	const socket = new WebSocket(address);
	let timer: ReturnType<typeof setTimeout>;
	try {
		return await new Promise<number>((resolve, reject) => {
			timer = setTimeout(() => reject(new Error('The Worker heap read timed out.')), 5000);
			socket.on('error', reject);
			socket.on('close', () =>
				reject(new Error('The Worker inspector closed before its heap read.'))
			);
			socket.on('open', () =>
				socket.send(JSON.stringify({ id: 1, method: 'Runtime.getHeapUsage' }))
			);
			socket.on('message', (bytes) => {
				try {
					const answer = JSON.parse(bytes.toString());
					if (answer.id !== 1) return;
					const used = answer.result?.usedSize;
					if (!Number.isFinite(used) || used <= 0)
						throw new Error('The Worker reported no usable heap observation.');
					resolve(used);
				} catch (error) {
					reject(error);
				}
			});
		});
	} finally {
		clearTimeout(timer!);
		socket.terminate();
	}
}
