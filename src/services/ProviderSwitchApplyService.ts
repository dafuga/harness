import type {
	SessionControl,
	SessionObservation,
	SwitchRequest,
	SwitchStore
} from '../core/pickerTypes';
import { switchRevision } from '../core/pickerTypes';
import { sameSelection, validateSessionId } from '../core/pickerModelTypes';

/** Internal boundary only: no desktop adapter is installed or exposed through MCP. */
export class ProviderSwitchApplyService {
	constructor(
		private readonly store: SwitchStore,
		private readonly control: SessionControl
	) {}
	async apply(sessionId: string): Promise<void> {
		validateSessionId(sessionId);
		const request = this.store.get(sessionId);
		if (request?.status !== 'pending') return;
		const previous = await this.control.inspect(sessionId);
		if (!this.ready(previous)) return;
		const claimed = {
			...request,
			status: 'applying' as const,
			reason: 'Verifying the selected provider.'
		};
		if (!this.store.put(claimed, switchRevision(request))) return;
		try {
			const latest = await this.control.inspect(sessionId);
			if (!this.ready(latest) || !sameSelection(latest.selection, previous.selection)) {
				this.finish(claimed, 'pending', 'Session changed; close every client before retrying.');
				return;
			}
			await this.control.resume(sessionId, request.target);
			const result = await this.control.inspect(sessionId);
			if (!this.fresh(result) || !sameSelection(result.selection, request.target))
				throw new Error('Settings mismatch');
			this.finish(claimed, 'applied', 'Provider, model and effort verified after resume.');
		} catch {
			await this.rollback(claimed, previous);
		}
	}

	private fresh(state: SessionObservation): boolean {
		const age = Date.now() - Date.parse(state.observedAt);
		return age >= -1000 && age < 30_000;
	}
	private ready(state: SessionObservation): boolean {
		return state.idle && state.clients === 0 && this.fresh(state);
	}
	private finish(record: SwitchRequest, status: SwitchRequest['status'], reason: string): void {
		if (!this.store.put({ ...record, status, reason }, switchRevision(record)))
			throw new Error('Switch ownership changed; settings require manual verification.');
	}
	private async rollback(record: SwitchRequest, previous: SessionObservation): Promise<void> {
		let reason =
			'Application failed; previous settings could not be verified. Manual recovery required.';
		try {
			await this.control.resume(record.sessionId, previous.selection);
			const restored = await this.control.inspect(record.sessionId);
			if (this.fresh(restored) && sameSelection(restored.selection, previous.selection))
				reason = 'Application failed; previous provider settings restored and verified.';
		} catch {
			/* Keep uncertainty explicit; never retry a failed resume automatically. */
		}
		this.finish(record, 'failed', reason);
	}
}
