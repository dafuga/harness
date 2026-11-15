// @harness-uid u_o2djhpwgs7
import type { z } from 'zod';
import type { videoManifestBaseSchema, videoCaptureSchema } from './videoClipSchema';

export type VideoManifest = z.infer<typeof videoManifestBaseSchema>;
export type VideoCapture = z.infer<typeof videoCaptureSchema>;
export type VideoClip = VideoManifest['clips'][number];
export type VideoGraph = VideoManifest['graphs'][number];
export type VideoDeclaration =
	| null
	| boolean
	| number
	| string
	| VideoDeclaration[]
	| { [name: string]: VideoDeclaration };
