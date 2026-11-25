// @harness-uid u_idvtlr5mn3
import type {
	ScopeKeys,
	SealedJsonValue
} from '../../../../remote/src/models/networking-security/Sealed.types';

export interface SessionStreamTarget {
	origin: string;
	device: string;
	bearer: string;
	keys: ScopeKeys;
}

export interface SessionStreamTransport {
	readRevision(scope: string, objectId: string): Promise<bigint>;
	putObject(scope: string, objectId: string, envelope: Uint8Array): Promise<void>;
	sendFrame(frame: Uint8Array): Promise<void>;
	close(): void;
}

export interface SessionRunStatus {
	status: string;
	details?: SealedJsonValue;
}
