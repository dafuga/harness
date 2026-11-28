// @harness-uid u_eltmiglca4
import type { Socket } from 'node:net';
import type { z } from 'zod';
import type { VaultDeviceRepository } from '../../repositories/accounts-access/VaultDeviceRepository';
import type { VaultBrokerService } from '../../services/accounts-access/VaultBrokerService';
import type { VaultLeaseKeeperService } from '../../services/accounts-access/VaultLeaseKeeperService';
import type { VaultPaymentService } from '../../services/accounts-access/VaultPaymentService';

export interface VaultBrokerServerConfig {
	broker: VaultBrokerService;
	keeper: VaultLeaseKeeperService;
	devices: VaultDeviceRepository;
	/** Absolute socket path; its directory is created owner-only. */
	socketPath: string;
	/** Kernel-verified peer user of a connection, or null when the platform cannot tell. */
	peerUid?: (socket: Socket) => number | null;
	/** Device-only purchase routes for a broker composed with a private executor. */
	payments?: VaultPaymentService;
}

/** One JSON route: its request schema and the call that answers it for a peer user. */
export interface VaultBrokerRoute {
	schema: z.ZodType;
	run: (body: never, uid: number | null) => unknown;
}
