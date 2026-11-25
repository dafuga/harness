export interface Message {
	data: string | ArrayBuffer;
}

export interface Native {
	binaryType: string;
	send(data: string | Uint8Array): void;
	close(): void;
	addEventListener(type: string, listener: (event: Message & { code?: number }) => void): void;
}
