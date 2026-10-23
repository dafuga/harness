import type { GameWorkspaceProps as Props } from '../../models/game-authoring/GameWorkspace.types';

export type Source = Pick<Props, 'projectId' | 'commit' | 'bridge'>;
