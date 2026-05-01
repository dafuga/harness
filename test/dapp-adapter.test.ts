import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { auditProject } from '../src/audit/audit';

test('dapp profile accepts Antelope template contract structure', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-dapp-valid-'));
	try {
		await writeValidContract(root, 'smart-contract/contracts/example');
		await writeFile(
			join(root, 'smart-contract/Makefile'),
			'build:\n\tcd contracts/example && make\n'
		);

		const result = await auditProject(root, { profile: 'dapp' });

		expect(result.findings).toEqual([]);
		expect(result.coverage.coveredFiles).toEqual(
			expect.arrayContaining([
				'smart-contract/contracts/example/src/example.cpp',
				'smart-contract/contracts/example/include/example/example.hpp'
			])
		);
		expect(result.coverage.unknownFiles).toEqual([]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('dapp profile accepts Harbor contract source and ricardian structure', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-dapp-harbor-'));
	try {
		await writeValidContract(root, 'contracts/svcmarket', 'src');
		await mkdir(join(root, 'contracts/svcmarket/ricardian'), { recursive: true });
		await writeFile(join(root, 'contracts/CMakeLists.txt'), 'add_subdirectory(svcmarket)\n');
		await writeFile(join(root, 'contracts/svcmarket/ricardian/claim.md'), '# Claim\n');

		const result = await auditProject(root, { profile: 'dapp' });

		expect(result.findings).toEqual([]);
		expect(result.coverage.coveredFiles).toEqual(
			expect.arrayContaining(['contracts/svcmarket/src/svcmarket.cpp'])
		);
		expect(result.coverage.unknownFiles).toEqual([]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('dapp profile accepts auditing a Harbor contracts directory directly', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-dapp-harbor-root-'));
	try {
		await writeValidContract(root, 'svcmarket', 'src');
		await mkdir(join(root, 'svcmarket/ricardian'), { recursive: true });
		await writeFile(join(root, 'CMakeLists.txt'), 'add_subdirectory(svcmarket)\n');
		await writeFile(join(root, 'svcmarket/ricardian/claim.md'), '# Claim\n');

		const result = await auditProject(root, { profile: 'dapp' });

		expect(result.findings).toEqual([]);
		expect(result.coverage.coveredFiles).toEqual(
			expect.arrayContaining(['svcmarket/src/svcmarket.cpp'])
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('dapp profile rejects contract folders outside Antelope conventions', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-dapp-invalid-'));
	try {
		await mkdir(join(root, 'contracts/token/source'), { recursive: true });
		await writeFile(join(root, 'contracts/token/source/main.cpp'), 'void apply() {}\n');
		await writeFile(join(root, 'contracts/token/token.contracts.md'), '# Token\n');

		const rules = (await auditProject(root, { profile: 'dapp' })).findings.map(
			(finding) => finding.rule
		);

		expect(rules).toEqual(
			expect.arrayContaining([
				'antelope-contract-workspace',
				'antelope-contract-source',
				'antelope-contract-header',
				'antelope-ricardian-placement'
			])
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

async function writeValidContract(
	root: string,
	dir: string,
	headerFolder = 'include'
): Promise<void> {
	const name = dir.split('/').at(-1) ?? 'contract';
	const headerDir = headerFolder === 'src' ? `${dir}/src` : `${dir}/include/${name}`;
	await mkdir(join(root, `${dir}/src`), { recursive: true });
	await mkdir(join(root, headerDir), { recursive: true });
	await writeFile(join(root, `${dir}/src/${name}.cpp`), `#include "${name}.hpp"\n`);
	await writeFile(join(root, `${headerDir}/${name}.hpp`), '#pragma once\n');
}
