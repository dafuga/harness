

export type MediaFacts =
	| { kind: 'image'; width: number; height: number }
	| { kind: 'audio'; durationSeconds: number }
	| { error: string };

export { pngChecksum, mediaFacts } from '../services/check-run-service/mediaFacts';
