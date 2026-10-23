/** What the preload is given over IPC to open its socket. Valid once, for a few seconds. */
export interface LocalBootstrap {
	port: number;
	ticket: string;
}

/**
 * One text frame of a plain transport: a slice of one wire message. `data` is standard base64
 * of at most `chunkBytes` UTF-8 bytes; `index` counts from 0 within `message`; frames of several
 * messages may alternate.
 */
export interface WirePart {
	type: 'part';
	message: number;
	index: number;
	last: boolean;
	data: string;
}
export { localTransport } from './RemoteLocalValues';
