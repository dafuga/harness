import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { auditProject } from '../audit/audit';
import type { AuditProfile, AuditResult } from '../audit/adapters/types';
import { fail } from '../core/errors';

export interface VerifyStep {
	label: string;
}

export interface VerifyResult {
	audit?: AuditResult;
	exitCode: number;
	failedStep?: string;
	ok: boolean;
}

interface VerifyInput {
	e2e?: boolean;
	onStep?: (step: VerifyStep) => void;
	profile: AuditProfile;
	root: string;
}

type PackageScripts = Record<string, string>;

export async function verifyProject(input: VerifyInput): Promise<VerifyResult> {
	const root = resolve(input.root);
	const scripts = await readPackageScripts(root);

	for (const script of scriptPlan(scripts, Boolean(input.e2e))) {
		input.onStep?.({ label: `bun run ${script}` });
		const exitCode = runScript(root, script);
		if (exitCode !== 0) return { exitCode, failedStep: script, ok: false };
	}

	input.onStep?.({ label: 'harness audit .' });
	const audit = await auditProject(root, { profile: input.profile });
	const ok = audit.findings.length === 0;
	return { audit, exitCode: ok ? 0 : 1, ok };
}

function scriptPlan(scripts: PackageScripts, e2e: boolean): string[] {
	const steps = ['format:check', 'check', 'lint'];
	const testSteps = scripts['test:unit'] ? ['test:unit'] : ['test'];
	const e2eSteps = e2e && scripts['test:e2e'] ? ['test:e2e'] : [];
	return [...steps, ...testSteps, ...e2eSteps, 'build'].filter((script) => script in scripts);
}

function runScript(root: string, script: string): number {
	const result = spawnSync('bun', ['run', script], {
		cwd: root,
		stdio: 'inherit'
	});
	return result.status ?? 1;
}

async function readPackageScripts(root: string): Promise<PackageScripts> {
	try {
		const contents = await readFile(join(root, 'package.json'), 'utf8');
		const manifest = JSON.parse(contents) as { scripts?: PackageScripts };
		return manifest.scripts ?? {};
	} catch {
		return fail(`No readable package.json found in ${root}.`);
	}
}
