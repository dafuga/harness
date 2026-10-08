import { randomUUID } from 'node:crypto';
import type { PickerModel, ProviderSelection } from '../core/pickerModelTypes';
import { sameSelection, validateSessionId } from '../core/pickerModelTypes';
import type { PickerSnapshot, SessionControl, SwitchStore } from '../core/pickerTypes';
import { desktopControlUnavailable, switchRevision } from '../core/pickerTypes';

export class ProviderSwitchService {
	constructor(
		readonly store: SwitchStore,
		readonly catalog: { list(): Promise<PickerModel[]> },
		private readonly control?: SessionControl
	) {}

	async status(sessionId: string | null = null): Promise<PickerSnapshot> {
		if (sessionId) validateSessionId(sessionId);
		const active = sessionId && this.control ? await this.control.inspect(sessionId) : null;
		return {
			sessionId,
			defaultProvider: 'openai',
			active,
			request: sessionId ? this.store.get(sessionId) : null,
			models: await this.catalog.list(),
			controlConnected: Boolean(this.control),
			message: this.control
				? 'Switches require an idle session closed on every client.'
				: desktopControlUnavailable
		};
	}

	async request(sessionId: string, target: ProviderSelection): Promise<PickerSnapshot> {
		validateSessionId(sessionId);
		const known = (await this.catalog.list()).find(
			(m) => m.provider === target.provider && m.model === target.model
		);
		if (!known?.efforts.includes(target.effort))
			throw new Error('Selection is not in the configured model catalog.');
		const previous = this.store.get(sessionId);
		if (previous?.status === 'applying')
			throw new Error('A switch is being verified; wait before replacing it.');
		if (previous?.status === 'pending' && sameSelection(previous.target, target))
			return this.status(sessionId);
		const record = {
			id: randomUUID(),
			sessionId,
			target,
			status: 'pending' as const,
			createdAt: new Date().toISOString(),
			reason: desktopControlUnavailable
		};
		if (!this.store.put(record, switchRevision(previous)))
			throw new Error('Selection changed; refresh and retry.');
		return this.status(sessionId);
	}

	async cancel(sessionId: string, requestId: string): Promise<PickerSnapshot> {
		validateSessionId(sessionId);
		const current = this.store.get(sessionId);
		if (current?.id !== requestId || current.status !== 'pending')
			throw new Error('Pending selection changed; refresh first.');
		if (
			!this.store.put(
				{ ...current, status: 'cancelled', reason: 'Cancelled by the user.' },
				switchRevision(current)
			)
		)
			throw new Error('Pending selection changed; refresh first.');
		return this.status(sessionId);
	}
}
