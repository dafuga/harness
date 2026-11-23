import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { productionPromotion } from '../../src/utils/projects-sessions/productionPromotion';

const preprodCommit = 'a'.repeat(40);

function setupProject() {
	const root = mkdtempSync(join(tmpdir(), 'promotion-example-'));
	const bin = join(root, 'bin');
	const deploymentDirectory = join(root, '.git', 'harness-deployments');
	mkdirSync(bin);
	mkdirSync(deploymentDirectory, { recursive: true });
	const git = join(bin, 'git');
	writeFileSync(
		git,
		'#!/bin/sh\ncase "$*" in *"--git-common-dir"*) echo .git ;; *"rev-list --count"*) echo 2 ;; *"rev-parse"*) echo ' +
			preprodCommit +
			' ;; *) exit 0 ;; esac\n'
	);
	chmodSync(git, 0o755);
	writeFileSync(
		join(deploymentDirectory, 'receipts.json'),
		JSON.stringify([
			{
				environment: 'preprod',
				commit: preprodCommit,
				branch: 'main',
				updatedAt: '2026-01-01T00:00:00.000Z',
				adapter: 'cloudflare',
				deploymentId: 'preprod-1',
				configuration: 'current',
				url: 'https://preprod.example.test'
			}
		])
	);
	return { root, bin };
}

const config = {
	sourceBranch: 'main',
	targets: {
		preprod: {
			environment: 'preprod' as const,
			kind: 'pages' as const,
			config: 'wrangler.toml',
			name: 'site-preprod',
			accountId: 'account-a',
			tokenEnv: 'PREPROD_TOKEN',
			wranglerEnvironment: 'preprod',
			branch: 'main',
			output: 'dist',
			healthUrl: 'https://preprod.example.test/health'
		},
		prod: {
			environment: 'prod' as const,
			kind: 'pages' as const,
			config: 'wrangler.toml',
			name: 'site-prod',
			accountId: 'account-b',
			tokenEnv: 'PROD_TOKEN',
			wranglerEnvironment: 'production',
			branch: 'main',
			output: 'dist',
			healthUrl: 'https://prod.example.test/health'
		}
	}
};

test('reports verified preprod commits available for promotion', async () => {
	const { root, bin } = setupProject();
	vi.stubEnv('PATH', bin);
	try {
		const result = await productionPromotion(root, config, 'current');
		const summary = {
			blockers: result.blockers,
			branch: result.branch,
			preprodCommit: result.promotion.preprod?.commit,
			production: result.promotion.production,
			commitsBehind: result.promotion.commitsBehind
		};
		expect(summary).toEqual({
			blockers: [],
			branch: 'main',
			preprodCommit,
			production: null,
			commitsBehind: 2
		});
		recordExampleCases(
			{
				unitId: 'desktop.function.production-promotion',
				symbol: 'productionPromotion',
				state: 'reports-verified-preprod-commits-available-for-promotion',
				evidence: 'examples-cases',
				file: 'reports-verified-preprod-commits-available-for-promotion.json'
			},
			[
				{
					name: 'promote current verified preprod configuration',
					input: { config, fingerprint: 'current', preprodCommit },
					output: summary
				}
			]
		);
	} finally {
		vi.unstubAllEnvs();
		rmSync(root, { recursive: true, force: true });
	}
});
