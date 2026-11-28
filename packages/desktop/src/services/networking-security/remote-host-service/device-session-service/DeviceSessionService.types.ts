// @harness-uid u_jfnzmu243b
import type { ClientProjectsOptions } from './ClientProjectsService';
import type { RemoteGrant } from '../../../../../../remote/src/index';

export interface DeviceSessionOptions extends Omit<ClientProjectsOptions, 'emit'> {
	host: { id: string; name: string };
	device: { id: string; name: string };
	grant: () => RemoteGrant;
	/** The Home view of this computer, offered to the devices of the signed-in account. */
	home?: () => Promise<unknown>;
	/** One answer or note from that Home view, offered to the same devices. */
	homeChat?: (input: Record<string, unknown>) => Promise<unknown>;
	/** One document belonging to an open ask on this computer. */
	homeDocument?: (input: Record<string, unknown>) => Promise<unknown>;
	trackerPull?: (input: Record<string, unknown>) => Promise<unknown>;
	trackerPush?: (input: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>;
	epoch?: string;
	/** Whether the screen is locked, once the computer knows; undefined until then. */
	locked?: () => boolean | undefined;
}
