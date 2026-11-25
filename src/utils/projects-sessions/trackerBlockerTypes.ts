// @harness-uid u_dv4lnm54rz
import type { TrackerBlockerType } from './trackerBlockerTypes.types';

export const trackerBlockerTypes = [
	'credential_access',
	'daniel_decision',
	'payment_cost',
	'external_person',
	'waiting_on_item',
	'technical'
] as const;

export const trackerBlockerLabels: Record<TrackerBlockerType, string> = {
	credential_access: 'Credential / access',
	daniel_decision: 'Daniel decision',
	payment_cost: 'Payment / cost',
	external_person: 'External person',
	waiting_on_item: 'Waiting on another item',
	technical: 'Technical'
};
