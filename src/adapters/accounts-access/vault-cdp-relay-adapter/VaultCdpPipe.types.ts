// @harness-uid u_xadic2nwwc
import type { Readable, Writable } from 'node:stream';

export interface VaultCdpPipeStreams {
	readable: Readable;
	writable: Writable;
}

export interface VaultCdpMessage {
	id?: number;
	method?: string;
	sessionId?: string;
	params?: { sessionId?: string };
	result?: { sessionId?: string };
}

export interface VaultCdpReader {
	message(text: string): void;
	close(): void;
}
