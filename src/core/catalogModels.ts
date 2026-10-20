import { CatalogBranch } from '../models/CatalogBranch';
import { CatalogDependency } from '../models/CatalogDependency';
import { CatalogEntity } from '../models/CatalogEntity';
import { CatalogMetadata } from '../models/CatalogMetadata';
import { CatalogRecord } from '../models/CatalogRecord';
import { CatalogRevision } from '../models/CatalogRevision';
import { CatalogRevisionEntity } from '../models/CatalogRevisionEntity';
import { CatalogScenario } from '../models/CatalogScenario';

/** Every application table in the query index has one declared model. */
export const catalogModels = [
	CatalogMetadata,
	CatalogBranch,
	CatalogRevision,
	CatalogEntity,
	CatalogRevisionEntity,
	CatalogDependency,
	CatalogRecord,
	CatalogScenario
] as const;
