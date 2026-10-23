import type { DesktopBridge } from '../src/models/DesktopBridge.types';

export type Reads = Required<Pick<DesktopBridge, 'evidence' | 'artifact'>>;

export interface BridgeOptions {
	/** Hashes whose bytes arrive damaged, though the answer states the recorded hash. */
	corrupt?: string[];
	/** Hashes the backend gives no bytes for. */
	refuse?: string[];
}
