import type { AuditAdapter, AuditStructure } from './types';
import type { AuditFinding } from '../types';

export const antelopeDappAdapter: AuditAdapter = {
	id: 'antelope-dapp',
	label: 'Antelope and Harbor dApps',
	profiles: ['dapp'],
	extensions: [],
	optionalTools: ['antelope-cli', 'cdt-cpp'],
	audit() {
		return [];
	},
	auditStructure(structure) {
		return [
			...auditContractWorkspace(structure),
			...auditContractDirectories(structure),
			...auditRicardianPlacement(structure)
		];
	}
};

function auditContractWorkspace(structure: AuditStructure): AuditFinding[] {
	if (contractDirs(structure).length === 0) return [];
	if (
		hasAnyFile(structure, ['CMakeLists.txt', 'smart-contract/Makefile', 'contracts/CMakeLists.txt'])
	) {
		return [];
	}
	if (
		contractDirs(structure).some((dir) =>
			hasAnyFile(structure, [`${dir}Makefile`, `${dir}CMakeLists.txt`])
		)
	) {
		return [];
	}
	return [
		{
			path: contractWorkspacePath(structure),
			rule: 'antelope-contract-workspace',
			message:
				'Antelope dApps should declare contract build tooling with Makefile or CMakeLists.txt.'
		}
	];
}

function auditContractDirectories(structure: AuditStructure): AuditFinding[] {
	return contractDirs(structure).flatMap((dir) => [
		...auditContractSource(structure, dir),
		...auditContractHeader(structure, dir)
	]);
}

function auditContractSource(structure: AuditStructure, dir: string): AuditFinding[] {
	const name = contractName(dir);
	if (structure.files.includes(`${dir}src/${name}.cpp`)) return [];
	return [
		{
			path: dir,
			rule: 'antelope-contract-source',
			message: `Contract "${name}" should have its primary implementation at ${dir}src/${name}.cpp.`
		}
	];
}

function auditContractHeader(structure: AuditStructure, dir: string): AuditFinding[] {
	const name = contractName(dir);
	const accepted = [`${dir}include/${name}/${name}.hpp`, `${dir}src/${name}.hpp`];
	if (hasAnyFile(structure, accepted)) return [];
	return [
		{
			path: dir,
			rule: 'antelope-contract-header',
			message: `Contract "${name}" should expose ${name}.hpp under include/${name}/ or src/.`
		}
	];
}

function auditRicardianPlacement(structure: AuditStructure): AuditFinding[] {
	return structure.files.flatMap((file) => {
		if (!/\.(?:clauses|contracts)\.md$/.test(file) || isRicardianFile(file)) return [];
		return [
			{
				path: file,
				rule: 'antelope-ricardian-placement',
				message:
					'Ricardian clauses and contracts should live under a contract src/ or ricardian/ folder.'
			}
		];
	});
}

function contractDirs(structure: AuditStructure): string[] {
	return structure.dirs
		.filter(
			(dir) =>
				/^smart-contract\/contracts\/[^/]+\/$/.test(dir) ||
				/^contracts\/[^/]+\/$/.test(dir) ||
				isDirectContractDir(structure, dir)
		)
		.sort();
}

function isDirectContractDir(structure: AuditStructure, dir: string): boolean {
	return (
		structure.files.includes('CMakeLists.txt') &&
		/^[^/]+\/$/.test(dir) &&
		structure.dirs.includes(`${dir}src/`)
	);
}

function contractName(dir: string): string {
	return dir.replace(/\/$/, '').split('/').at(-1) ?? '';
}

function contractWorkspacePath(structure: AuditStructure): string {
	return structure.dirs.some((dir) => dir.startsWith('smart-contract/'))
		? 'smart-contract/'
		: 'contracts/';
}

function hasAnyFile(structure: AuditStructure, files: string[]): boolean {
	return files.some((file) => structure.files.includes(file));
}

function isRicardianFile(file: string): boolean {
	return (
		/^[^/]+\/(?:src|ricardian)\//.test(file) ||
		/^contracts\/[^/]+\/(?:src|ricardian)\//.test(file) ||
		/^smart-contract\/contracts\/[^/]+\/(?:src|ricardian)\//.test(file)
	);
}
