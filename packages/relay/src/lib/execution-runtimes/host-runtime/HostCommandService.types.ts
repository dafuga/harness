import type { RelayHostCommand } from '../../../../../remote/src/index';

export type Acknowledged = Extract<RelayHostCommand, { ref: string }>;

export interface Address {
	deviceId: string;
	connectionId: string;
}
