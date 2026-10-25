import { test } from 'vitest';
import { componentManifestSchema, type ComponentManifest } from '../../src/core/unitTypes';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import {
	commitMessage as publicCommitMessage,
	writtenMessage as publicWrittenMessage
} from '../../src/services/commit-message-service/commitMessage';
import {
	commitMessage as ownerCommitMessage,
	writtenMessage as ownerWrittenMessage
} from '../../src/services/git-source-history/commit-message-service/commitMessage';
import { commitPrefixes as publicCommitPrefixes } from '../../src/utils/commitMessage';
import { commitPrefixes as ownerCommitPrefixes } from '../../src/utils/git-source-history/commitMessage';
import manifest from '../../specification/units/function.commit-message.json' with { type: 'json' };
import { commitMessageExamples } from '../support/commitMessageExamples';

componentManifestSchema.parse(manifest);

new TestExpectationService().registerExamples(
	test,
	manifest as ComponentManifest,
	commitMessageExamples({
		ownerCommitMessage,
		publicCommitMessage,
		ownerWrittenMessage,
		publicWrittenMessage,
		ownerCommitPrefixes,
		publicCommitPrefixes
	})
);
