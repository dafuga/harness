import { createConnection, type Socket } from 'node:net';
import { closeE2eRun } from '../../../src/utils/e2e-fixtures/e2eFixtures';

/** The longest line a gate sends; a gate that sends more is not waited for. */
const longest = 4096;

/**
 * Resolves once a whole `release` line arrives on a gate's socket, however its bytes are split, or
 * once the socket closes or fails: a gate that is closed, or that no one holds, holds nothing.
 */
export function releasedBy(socket: Socket): Promise<void> {
	return new Promise((done) => {
		let held = '';
		socket.setEncoding('utf8');
		socket.on('data', (chunk: string) => {
			const lines = (held + chunk).split('\n');
			held = lines.pop() ?? '';
			// Lines are read in order: a release counts only if no line before it was too long.
			const first = lines.find((line) => line === 'release' || line.length > longest);
			if (first === 'release') socket.end();
			else if (first !== undefined || held.length > longest) socket.destroy();
		});
		socket.on('error', () => done());
		socket.on('close', () => done());
	});
}

/** Waits at the gate an observer named for this run, telling it which directory would go. */
function released(gate: string, root: string): Promise<void> {
	const socket = createConnection(gate, () => socket.write(`${root}\n`));
	return releasedBy(socket);
}

/**
 * Ends a run: the directory it made is removed, and nothing of any other run. A run started with
 * HARNESS_E2E_TEARDOWN_GATE keeps it until its observer lets it go.
 */
export default async function removeFixtures(): Promise<void> {
	const gate = process.env.HARNESS_E2E_TEARDOWN_GATE;
	if (gate) await released(gate, process.env.HARNESS_E2E_ROOT ?? '');
	closeE2eRun();
}
