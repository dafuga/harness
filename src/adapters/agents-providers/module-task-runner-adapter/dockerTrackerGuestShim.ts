// @harness-uid u_rw64iex44n
// A standalone Bun program embedded in the managed container command.
export const trackerGuestShimSource: string = String.raw`
import { once } from 'node:events';
import { createConnection } from 'node:net';
import console from 'node:console';
import process from 'node:process';
import { parseArgs } from 'node:util';

const positionalText = new Set(['note', 'progress', 'flag', 'block']);
const actions = new Set(['start', 'show', 'done', ...positionalText]);

function commandFrame([action, ...args]) {
	if (!actions.has(action)) throw new TypeError('command is unavailable for this Tracker run');
	const {
		positionals: [id, ...words],
		values
	} = parseArgs({
		args,
		allowPositionals: true,
		options: {
			json: { type: 'boolean' },
			...(action === 'done' ? { note: { type: 'string' } } : {})
		}
	});
	if (!id || (words.length && !positionalText.has(action)))
		throw new TypeError('expected an assigned item ID and supported command arguments');
	const text = positionalText.has(action) ? words.join(' ') : values.note;
	if (positionalText.has(action) && !text?.trim()) throw new TypeError('Tracker text is required');
	return {
		frame: JSON.stringify([id, action, text ?? null]),
		json: values.json || action === 'show'
	};
}

async function requestTracker(frame) {
	const path = process.env.HARNESS_TRACKER_GUEST_SOCKET;
	if (!path) throw new Error('Tracker relay socket unavailable');
	const socket = createConnection({ path, allowHalfOpen: true });
	socket.setTimeout(20_000, () => socket.destroy());
	socket.on('error', () => {});
	try {
		await once(socket, 'connect');
		await writeFrame(socket, frame);
		return JSON.parse(await readFramePayload(readFrames(socket)));
	} finally {
		socket.destroy();
	}
}

async function trackerMain(args) {
	if (!args.length || args[0] === 'help' || args[0] === '--help') {
		console.log(
			'Usage: tracker start|show|note|progress|flag|block|done <assigned-item> [arguments] [--json]'
		);
		return 0;
	}
	const { frame, json } = commandFrame(args);
	const [status, result] = await requestTracker(frame);
	if (status >= 200 && status < 300) {
		console.log(json ? JSON.stringify(result, null, 2) : '[' + result.id + '] ' + result.status);
		return 0;
	}
	console.error('tracker: ' + (result.error ?? 'HTTP ' + status));
	return status === 503 ? 3 : 1;
}

try {
	process.exitCode = await trackerMain(process.argv.slice(2));
} catch (error) {
	console.error(
		error instanceof TypeError ? 'tracker: ' + error.message : 'tracker: relay unavailable'
	);
	process.exitCode = 1;
}
`;
