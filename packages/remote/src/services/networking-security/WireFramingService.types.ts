export interface WireFramingOptions {
	/** Writes one text frame to the transport. */
	write: (frame: string) => void;
	/** Runs the next step of sending later, so the frames of several messages take turns. */
	defer?: (step: () => void) => void;
	chunkBytes?: number;
	frameBytes?: number;
	/** The largest message accepted from the other side, and the largest one sent. */
	incomingBytes?: number;
	outgoingBytes?: number;
	/** The most parts one incoming message may have. */
	parts?: number;
	/** Multipart messages in flight at one time: accepted from the other side, and sent to it. */
	streams?: number;
}

export interface Outgoing {
	bytes: Uint8Array;
	offset: number;
	/** Given when its first frame is written, so ids rise in the order messages start. */
	id: number | null;
}

export interface Assembly {
	parts: Uint8Array[];
	size: number;
	next: number;
}
