import type { GatewaySession } from '../utils/gatewayTypes';

export class GatewayEventsService {
	private readonly scheduled = new Set<string>();

	finishToolBatch(session: GatewaySession): void {
		if (this.scheduled.has(session.id)) return;
		this.scheduled.add(session.id);
		setTimeout(() => {
			this.scheduled.delete(session.id);
			session.emit?.({ type: 'done' });
		}, 50);
	}
}
