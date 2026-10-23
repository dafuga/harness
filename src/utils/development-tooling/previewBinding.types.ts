import type { ComponentManifest } from '../../core/development-tooling/unitTypes';

export type PreviewUnit = Pick<ComponentManifest, 'id' | 'scenarios' | 'preview'>;
