import { test } from 'vitest';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import type { ComponentManifest } from '../../src/core/unitTypes';
import { testPath, metadata } from '../../src/utils/verification-evidence/regressionFiles';
import {
	invokeRegressionFiles,
	invokeRegressionFix,
	invokeRegressionTestCommit
} from '../support/regressionInputExamples';
import manifest from '../../specification/units/function.regression-files.json';

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	testPath,
	metadata,
	regressionFiles: invokeRegressionFiles,
	regressionFixCommit: invokeRegressionFix,
	regressionTestCommit: invokeRegressionTestCommit
});
