// @harness-uid u_jmiv5hvdhb
import type { DeviceApprovalAction } from '../../../../models/development-tooling/Environment.types';

/** The fixed approval channel never forwards a caller-supplied path, credential or helper verb. */
export function deviceApprovalInput(value: unknown): DeviceApprovalAction | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return;
	const { action, id, code } = value as Record<string, unknown>;
	if (action === 'list') return { action };
	if (typeof id !== 'string' || id.length !== 32 || !/^[0-9a-f]+$/.test(id)) return;
	if (action === 'review' || action === 'deny') return { action, id };
	if (action === 'approve' && typeof code === 'string' && code.length === 6 && /^\d+$/.test(code))
		return { action, id, code };
}
