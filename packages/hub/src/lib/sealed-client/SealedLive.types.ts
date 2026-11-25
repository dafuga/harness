// @harness-uid u_jsxj7qkjr5
import type { ScopeKeys } from '../../../../remote/src/models/networking-security/Sealed.types';

export interface SealedLiveOptions {
	device: string;
	scopes: string[];
	readKeys: (scope: string, epoch: number) => Promise<ScopeKeys | undefined>;
	onObjects: () => void;
	onOutput: (stream: string, chunks: LiveChunk[]) => void;
}

export interface StreamTail {
	key: CryptoKey;
	counter: bigint;
	decoder: TextDecoder;
	chunks: LiveChunk[];
	chars: number;
}

export interface LiveChunk {
	counter: string;
	text: string;
}

export interface SealedLiveNotice {
	t?: string;
	kind?: string;
	ring?: number;
}
