import { gatewayTypes, type GatewayItem, type GatewaySession } from '../utils/gatewayTypes';

export class CodexSessionRepository {
	private readonly sessions = new Map<string, GatewaySession>();

	create(id: string): GatewaySession {
		const existing = this.sessions.get(id);
		if (existing?.controller.signal.aborted)
			throw new Error('Session cancelled; restart requires explicit recovery');
		if (existing) return existing;
		if (this.sessions.size >= 100) throw new Error('Prototype session limit reached');
		const session = gatewayTypes(id);
		this.sessions.set(id, session);
		return session;
	}

	waitForTool(session: GatewaySession, id: string): Promise<string> {
		if (session.pending.has(id) || session.delivered.has(id)) throw new Error('Duplicate call');
		return new Promise((resolve, reject) => session.pending.set(id, { resolve, reject }));
	}

	deliver(session: GatewaySession, outputs: GatewayItem[]): void {
		const ids = outputs.map((output) => String(output.call_id));
		if (new Set(ids).size !== ids.length) throw new Error('Duplicate tool output');
		for (const id of ids) {
			if (!session.pending.has(id)) throw new Error('Unknown or already delivered tool call');
		}
		for (const output of outputs) {
			const id = String(output.call_id);
			session.pending
				.get(id)!
				.resolve(typeof output.output === 'string' ? output.output : JSON.stringify(output.output));
			session.pending.delete(id);
			session.delivered.add(id);
		}
	}

	cancel(session: GatewaySession): void {
		session.controller.abort();
		for (const pending of session.pending.values()) pending.reject(new Error('Session cancelled'));
		session.pending.clear();
	}
}
