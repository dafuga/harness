// @harness-uid u_xxzceoo5bx
import type { UnitDocumentation } from '../../../../../../../src/utils/explorer-ui/unit-documentation/unitDocumentation.types';

export type DocumentationResult = Promise<UnitDocumentation | undefined>;

/**
 * A Git source read the adapter refuses: no local branch is selected, a commit lies outside the
 * selected branch, a manifest ID does not match its filename, or a path lies outside the unit
 * source contract.
 */
export { GitSourceError } from './GitSourceError';
