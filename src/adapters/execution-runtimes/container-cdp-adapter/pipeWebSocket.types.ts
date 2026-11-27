// @harness-uid u_o472ng3iiw
export interface PipeWebSocketHandlers {
	message(text: string): void;
	close(): void;
}
