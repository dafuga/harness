import type { BrowserDiagnostic } from '../../../../../core/development-tooling/browserDiagnostics';

export type Read = { browserErrors?: BrowserDiagnostic[]; failure?: string };
