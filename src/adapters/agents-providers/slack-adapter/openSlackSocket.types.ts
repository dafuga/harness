// @harness-uid u_q2c7gkxgki
export interface SlackSocketConnection {
	frames: AsyncIterable<unknown>;
	ack(envelopeId: string): Promise<void>;
	close(): void;
}
