import type { confirmUnload } from '../../src/lib/development-tooling/desktop-initialization/initialize-desktop/confirmUnload';

export type ExampleWindow = Parameters<typeof confirmUnload>[0];

export type ExampleDialog = Parameters<typeof confirmUnload>[1];

export type UnloadEvent = { defaultPrevented: boolean; preventDefault: () => void };

export type UnloadListener = (event: UnloadEvent) => void;
