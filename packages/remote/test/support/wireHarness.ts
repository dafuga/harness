import type {
	RemoteResume,
	WireEvent,
	WireMessage,
	WireRequest,
	WireResponse
} from '../../src/models/Remote.types';
import { WireSessionService } from '../../src/services/WireSessionService';
import type { WireSessionOptions } from '../../src/services/WireSessionService';

export const uuid = () => crypto.randomUUID();
export const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
export function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
/** A device session whose handler records what reached it and echoes the input. */
export function wireSession(overrides: Partial<WireSessionOptions> = {}) {
	const calls: WireRequest[] = [];
	const session = new WireSessionService({
		role: 'device',
		methods: () => ['session.attach', 'snapshot', 'startRun', 'cancelRun'],
		describe: () => ({
			host: { id: 'a'.repeat(40), name: 'Fixture Mac', platform: 'darwin' },
			device: { id: 'b'.repeat(40), name: 'Fixture phone' },
			grant: { projects: [], agents: true }
		}),
		handle: async (request) => {
			calls.push(request);
			return { echo: request.input };
		},
		...overrides
	});
	return { session, calls };
}
/** One connection to a session, with everything it was sent. */
export function wireLink(session: WireSessionService) {
	const sent: WireMessage[] = [],
		state = { violations: 0 };
	const link = session.connect(
		(text) => sent.push(JSON.parse(text) as WireMessage),
		() => {
			state.violations++;
		}
	);
	const answer = (id: string) =>
		sent.filter((m): m is WireResponse => m.type === 'response' && m.id === id).at(-1);
	const call = async (method: string, input: Record<string, unknown> = {}, id = uuid()) => {
		await link.receive(JSON.stringify({ type: 'request', id, method, input }));
		return answer(id);
	};
	const attach = (resume: RemoteResume | null = null) =>
		call('session.attach', { protocol: 1, client: { kind: 'test', name: 'fixture' }, resume });
	const events = () => sent.filter((m): m is WireEvent => m.type === 'event');
	return { link, sent, state, call, attach, answer, events };
}
export function codeOf(response: WireResponse | undefined): string | undefined {
	return response && !response.ok ? response.error.code : undefined;
}
