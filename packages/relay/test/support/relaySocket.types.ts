export interface SocketClose {
	code: number;
	reason: string;
}

export interface SocketRefusal {
	status: number;
	error: string | null;
	upgrade: string | null;
}

export type Frame = Record<string, unknown>;
