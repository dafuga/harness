// @harness-uid u_xadic2nwwc
import type { Duplex } from 'node:stream';
import type { VaultLeaseKeeperService } from '../../services/accounts-access/VaultLeaseKeeperService';
import type { VaultCdpPipe } from './vault-cdp-relay-adapter/VaultCdpPipe';

export interface VaultCdpRelayAdapterConfig {
	keeper: VaultLeaseKeeperService;
	lease: string;
	peerUid: (socket: Duplex) => number | null;
	pipe: VaultCdpPipe;
}
