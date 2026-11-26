import type { GoogleIdentity } from '../../src/components/accounts-access/login-panel/googleButton.types';

export type InitConfig = Parameters<GoogleIdentity['initialize']>[0];

export interface Seen {
	init?: InitConfig;
	rendered?: { element: HTMLElement; options: Record<string, string> };
}

export interface FakeScript {
	src: string;
	async: boolean;
	onload: (() => void) | null;
	onerror: (() => void) | null;
}
