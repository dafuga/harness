import type { SwitchRequest } from '../../src/core/development-tooling/pickerTypes.types';

export const sessionId = 'session-01JAZ7K4W6M2';

/** The contract's example request; its status changes the revision stored as the row id. */
export function request(status: SwitchRequest['status'] = 'pending'): SwitchRequest {
	return {
		id: 'switch-request-01JAZ7K4W6M2Q9R3',
		sessionId,
		target: { provider: 'openai', model: 'gpt-5-codex', effort: 'medium' },
		status,
		createdAt: '2026-11-14T10:30:00.000Z',
		reason: 'Switch this session to the selected provider model.'
	};
}

/** A request for its own session, so that many switches can share one store. */
export function numbered(index: number): SwitchRequest {
	const suffix = String(index).padStart(3, '0');
	return { ...request(), id: `switch-request-${suffix}`, sessionId: `session-${suffix}` };
}
