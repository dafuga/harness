/** One accepted socket, as the client it belongs to sees it. Text frames only. */
export interface LocalSocket {
	send(text: string): void;
	close(code?: number): void;
	onText(listener: (text: string) => void): void;
	onClose(listener: () => void): void;
}

/** What a ticket was issued for: the client of one window. */
export interface LocalTransportTarget {
	attach(socket: LocalSocket): void;
}

export interface LocalTransportOptions {
	origin?: string;
	ticketMs?: number;
	tickets?: number;
	clients?: number;
	now?: () => number;
}

export interface Ticket {
	target: LocalTransportTarget;
	expiresAt: number;
}

export type Verdict = (accepted: boolean, code?: number, message?: string) => void;
