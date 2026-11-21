import type { z } from 'zod';
import type { answerSchema, sourceSchema, variationSchema } from './mockupSource';

export type MockupAnswer = z.infer<typeof answerSchema>;
export type MockupSource = z.infer<typeof sourceSchema>;
export type MockupVariation = z.infer<typeof variationSchema>;
export type MockupDocument = MockupAnswer['options'][number];

export interface MockupImage {
	state: string;
	viewport: `width-${number}`;
	bytes: Uint8Array;
}

export interface MockupCapture {
	option: number;
	state: string;
	viewport: { width: number; height: number };
	scheme: 'light' | 'dark';
	html: string;
}

export type RenderMockups = (
	captures: MockupCapture[],
	signal: AbortSignal
) => Promise<Uint8Array[]>;
