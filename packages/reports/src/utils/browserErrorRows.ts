import type { BrowserDiagnostic } from "../../../../src/core/browserDiagnostics";

export type Observed = BrowserDiagnostic['errors'][number];

export type BrowserErrorRow = Partial<Observed> & {
	type: Observed['type'];
	message: string;
	status: 'Expected' | 'Unexpected' | 'Missing expected error';
	reason?: string;
};

export { browserErrorRows } from '../components/browser-errors/browserErrorRows';
