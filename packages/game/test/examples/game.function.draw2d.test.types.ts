import type { draw2d } from '../../src/adapters/game-authoring/Canvas2dAdapter';

export type Run = Parameters<typeof draw2d>[1];

export type View = Parameters<typeof draw2d>[2];

export type Call = { method: string; args: unknown[] };
