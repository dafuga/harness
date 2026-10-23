/** What may be drawn: plain text of a bounded length, at one correction level. */
export const qrLimits = { maxBytes: 320, quiet: 4, maxModules: 77, level: 'M' } as const;

export { qrSymbol } from '../../components/networking-security/remote-offer-code/qrSymbol';

export type { QrSymbol } from './qrSymbol.types';
