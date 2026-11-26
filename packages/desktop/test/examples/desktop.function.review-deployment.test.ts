import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reviewDeployment } from '../../src/utils/projects-sessions/reviewDeployment';
import { developmentTarget, createProject } from './desktop.function.review-deployment.cases';

function plugin(
	discover: () => Promise<never> | Promise<{ sourceBranch: string; targets: object }>
) {
	return {
		id: 'cloudflare',
		discover,
		deploy: async () => ({ deploymentId: 'unused', url: 'unused' })
	};
}

function recordError(args: {
	state: string;
	name: string;
	expectedError: string;
	input: unknown;
	error: unknown;
}) {
	const { state, name, expectedError, input, error } = args;
	const output =
		error instanceof Error ? { name: error.name, message: error.message } : String(error);
	expect(error).toBeInstanceOf(Error);
	expect(output).toMatchObject({ name: expectedError });
	recordExampleCases(
		{
			unitId: 'desktop.function.review-deployment',
			symbol: 'reviewDeployment',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name, input, error: output }]
	);
}

async function captureFailure(
	root: string,
	discover: () => Promise<never> | Promise<{ sourceBranch: string; targets: object }>
) {
	try {
		await reviewDeployment(
			root,
			{ environment: 'dev', commit: 'a'.repeat(40) },
			{ plugin: plugin(discover), projectId: null }
		);
		throw new Error('Expected reviewDeployment to reject');
	} catch (error) {
		return error;
	}
}

test('Throws the plugin discovery error unchanged', async () => {
	const root = mkdtempSync(join(tmpdir(), 'review-discover-error-'));
	const failure = new Error('configuration unavailable');
	try {
		const error = await captureFailure(root, async () => {
			throw failure;
		});
		expect(error).toBe(failure);
		recordError({
			state: 'throws-the-plugin-discovery-error-unchanged',
			name: 'plugin discovery rejects',
			expectedError: 'Error',
			input: { root },
			error
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws an error when the project is not a Git repository', async () => {
	const root = mkdtempSync(join(tmpdir(), 'review-no-git-'));
	try {
		const error = await captureFailure(root, async () => ({
			sourceBranch: 'main',
			targets: { dev: developmentTarget() }
		}));
		recordError({
			state: 'throws-an-error-when-the-project-is-not-a-git-repository',
			name: 'Git read fails outside a repository',
			expectedError: 'Error',
			input: { root },
			error
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws a SyntaxError when deployment receipts contain invalid JSON', async () => {
	const { root } = createProject();
	try {
		mkdirSync(join(root, '.git', 'harness-deployments'));
		writeFileSync(join(root, '.git', 'harness-deployments', 'receipts.json'), '{');
		const error = await captureFailure(root, async () => ({
			sourceBranch: 'main',
			targets: { dev: developmentTarget() }
		}));
		recordError({
			state: 'throws-a-syntaxerror-when-deployment-receipts-contain-invali',
			name: 'receipt JSON is malformed',
			expectedError: 'SyntaxError',
			input: { root, contents: '{' },
			error
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws a ZodError when deployment receipts do not match the schema', async () => {
	const { root } = createProject();
	try {
		mkdirSync(join(root, '.git', 'harness-deployments'));
		writeFileSync(
			join(root, '.git', 'harness-deployments', 'receipts.json'),
			JSON.stringify([{ environment: 'dev', commit: 'bad' }])
		);
		const error = await captureFailure(root, async () => ({
			sourceBranch: 'main',
			targets: { dev: developmentTarget() }
		}));
		recordError({
			state: 'throws-a-zoderror-when-deployment-receipts-do-not-match-the',
			name: 'receipt commit fails validation',
			expectedError: 'ZodError',
			input: { root, receipt: { environment: 'dev', commit: 'bad' } },
			error
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
