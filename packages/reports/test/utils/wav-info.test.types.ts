export type Metadata = {
	encoding: number;
	channels: number;
	sampleRate: number;
	bytesPerSecond: number;
	blockAlign: number;
	bitsPerSample: number;
	dataBytes: number;
};
export type Fixture = {
	$fixture?: string;
	sampleRate?: number;
	metadata?: Metadata;
	matrix?: Metadata[];
} | null;
