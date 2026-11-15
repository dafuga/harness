// @harness-uid u_o2djhpwgs7
import type { z } from 'zod';
import type {
	videoManifestBaseSchema,
	videoCaptureSchema,
	videoBatchPointerSchema,
	videoReferenceSchema,
	videoCoverageSchema
} from './videoClipSchema';

export type VideoManifest = z.infer<typeof videoManifestBaseSchema>;
export type VideoCapture = z.infer<typeof videoCaptureSchema>;
export type VideoBatchPointer = z.infer<typeof videoBatchPointerSchema>;
export type VideoReference = z.infer<typeof videoReferenceSchema>;
export type VideoCoverage = z.infer<typeof videoCoverageSchema>;
export type VideoClip = VideoManifest['clips'][number];
export type VideoGraph = VideoManifest['graphs'][number];
export type VideoDeclaration =
	| null
	| boolean
	| number
	| string
	| VideoDeclaration[]
	| { [name: string]: VideoDeclaration };
