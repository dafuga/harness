import type {
	levelKey,
	atSpawn
} from '../../src/components/game-authoring/game-preview/gamePreviewReading';

export type View = Parameters<typeof levelKey>[0];

export type Run = Parameters<typeof atSpawn>[0];
