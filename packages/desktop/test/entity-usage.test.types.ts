import type { Relationship } from '../src/models/Desktop.types';

/**
 * What the workspace shows of the things around an entity: a section named Used In and one
 * named Uses, from the relationships its catalog recorded. Neither is called a relationship.
 */
export type Direction = Relationship['direction'];
