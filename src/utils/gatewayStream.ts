import type { GatewayEvent, GatewayItem, GatewaySession } from './gatewayTypes';
import { CodexResponsesSerializer } from '../serializers/CodexResponsesSerializer';
import type { CodexSessionRepository } from '../repositories/CodexSessionRepository';
export function gatewayStream(
	session: GatewaySession,
	repository: CodexSessionRepository,
	context?: { key: string; signal: globalThis.AbortSignal }
): Response {
	const serializer = new CodexResponsesSerializer('claude-opus-5-5');
	let ended = false;
	let snapshot = '';
	const stream = new globalThis.ReadableStream({
		start(controller) {
			const send = (events: GatewayItem[]) => {
				for (const event of events) {
					const chunk = `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`;
					snapshot += chunk;
					controller.enqueue(new globalThis.TextEncoder().encode(chunk));
				}
			};
			context?.signal.addEventListener(
				'abort',
				() => {
					if (!ended) repository.cancel(session);
				},
				{ once: true }
			);
			send(serializer.start());
			session.emit = (event: GatewayEvent) => {
				if (ended) return;
				if (event.type === 'text') send(serializer.text(event.text));
				if (event.type === 'call') send(serializer.call(event.call));
				if (event.type === 'done' || event.type === 'error') {
					ended = true;
					send(event.type === 'done' ? serializer.finish() : serializer.fail(event.message));
					if (context) session.replays.set(context.key, snapshot);
					controller.close();
					session.emit = undefined;
				}
			};
		},
		cancel() {
			if (!ended) {
				ended = true;
				session.emit = undefined;
				repository.cancel(session);
			}
		}
	});
	return new Response(stream, {
		headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' }
	});
}
