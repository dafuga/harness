import { test } from 'vitest';
import manifest from '../fixtures/contract-migration/source-branches-examples.json';
import type { ComponentManifest } from '../../src/core/unitTypes';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import { sourceBranches as repositorySourceBranches } from '../../src/repositories/source-history-repository/sourceBranches';
import { sourceBranches as utilitySourceBranches } from '../../src/utils/sourceBranches';
import { sourceBranchesExamples } from '../support/sourceBranchesExamples';

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	sourceBranches: sourceBranchesExamples(repositorySourceBranches, utilitySourceBranches)
});
