// @harness-uid u_vkj6mnyah7
export type MediaFacts =
	| { kind: 'image'; width: number; height: number }
	| { kind: 'audio'; durationSeconds: number }
	| {
			kind: 'video';
			width: number;
			height: number;
			durationSeconds: number;
			frameRate: number;
			frameCount: number;
			codec: 'h264';
			pixelFormat: 'yuv420p';
	  }
	| { error: string };

export {
	pngChecksum,
	mediaFacts
} from '../../workflows/verification-evidence/run-verify/verification-service/check-run-service/mediaFacts';
