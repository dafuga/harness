/** How the paired phone answers: an owner read, an unpaired phone, a switch to revoked, a denial after the link, a 503 or a non-owner's denial. */
export type PairedMode =
	| 'owner'
	| 'unpaired'
	| 'revoked'
	| 'denied'
	| 'unavailable'
	| 'non-owner'
	| 'sign-in'
	| 'approve';

/** One account request the SYNTHETIC native account double saw. */
export type PairedAccountCall = { method: string; path: string };

/** The window state the paired double exposes to the test: calls seen and the pairing switch. */
export type PairedPhoneHost = {
	__pairedAccountCalls: PairedAccountCall[];
	__pairedPhone: { setState: (state: string) => void; setAccount: (state: string) => void };
};

/** The arguments the init script receives: the mode and the synthetic overview it answers with. */
export type PairedInstall = { mode: PairedMode; snapshot: unknown };

/** The state of one synthetic paired phone, shared by its plugin doubles inside the page. */
export type PairedShell = {
	state: string;
	account: string;
	/** Overview reads answered so far; the first is the landing page's confirmation. */
	reads: number;
	serial: number;
	listeners: Map<string, { eventName: string; callback: (value: unknown) => void }>;
};

/** One imitated native plugin: each method takes its request as one value. */
export type PairedPlugin = Record<string, (value: never) => Promise<unknown>>;
