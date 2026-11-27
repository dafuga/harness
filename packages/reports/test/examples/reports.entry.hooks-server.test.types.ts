import type { handle } from '../../src/hooks.server';

export type HandleInput = Parameters<typeof handle>[0];

export type Resolve = HandleInput['resolve'];
