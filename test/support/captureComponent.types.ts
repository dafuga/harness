import type { CaptureContext } from './capturePage.types';
export interface ComponentCaptureContext extends CaptureContext { unit: string; }
export interface FixtureComponentContract { kind: string; testing: { cases: Array<{ id: string; input: Record<string, unknown> }> }; }
