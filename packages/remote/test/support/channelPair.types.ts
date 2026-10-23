export interface PairOptions {
	hostPins?: Uint8Array;
	devicePins?: Uint8Array;
	host?: { chunkBytes?: number; messageBytes?: number };
	device?: { chunkBytes?: number; messageBytes?: number };
}
