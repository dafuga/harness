import { CatalogBranch } from '../../models/git-source-history/CatalogBranch';
import { CatalogDependency } from '../../models/git-source-history/CatalogDependency';
import { CatalogEntity } from '../../models/git-source-history/CatalogEntity';
import { CatalogMetadata } from '../../models/git-source-history/CatalogMetadata';
import { CatalogRecord } from '../../models/git-source-history/CatalogRecord';
import { CatalogRevision } from '../../models/git-source-history/CatalogRevision';
import { CatalogRevisionEntity } from '../../models/git-source-history/CatalogRevisionEntity';
import { CatalogScenario } from '../../models/git-source-history/CatalogScenario';

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
