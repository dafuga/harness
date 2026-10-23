import type { CoverageStanding } from '../../../models/explorer-ui/Explorer.types';

export type Kind = CoverageStanding | 'unusable';

export type Reason = [Kind, string];
