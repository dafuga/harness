import type { CatalogEntity } from '../../../models/development-tooling/Desktop.types';

export type Judged = Pick<CatalogEntity, 'id' | 'kind' | 'verification' | 'verificationNote'>;
