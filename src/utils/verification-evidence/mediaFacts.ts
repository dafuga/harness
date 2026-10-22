export type MediaFacts =
	| { kind: 'image'; width: number; height: number }
	| { kind: 'audio'; durationSeconds: number }
	| { error: string };

export {
	pngChecksum,
	mediaFacts
} from '../../workflows/verification-evidence/run-verify/verification-service/check-run-service/mediaFacts';
