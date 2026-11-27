import type { explorerRelations } from '../../src/utils/explorer-ui/explorerRelations';
import type { units } from '../entityUnits';

export type Relations = ReturnType<typeof explorerRelations>;

export type Unit = (typeof units)[number];
