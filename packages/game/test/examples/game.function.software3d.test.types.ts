import type { Software3dAdapter } from '../../src/adapters/game-authoring/Software3dAdapter';
import type { makeContext, drawWith } from './game.function.software3d.fixtures';

export type Run = Parameters<Software3dAdapter['render']>[0];

export type View = Parameters<Software3dAdapter['render']>[1];

export type Context = ReturnType<typeof makeContext>;

export type Drawn = ReturnType<typeof drawWith>;
