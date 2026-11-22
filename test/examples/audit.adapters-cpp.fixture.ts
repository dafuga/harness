import type { Case } from './audit.adapters-cpp.test.types';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { cppAdapter } from '../../src/audit/development-tooling/adapters/cpp';
import type { AuditFile } from '../../src/audit/development-tooling/adapters/types';
import { maskTemplateLiterals, splitLines } from '../../src/audit/development-tooling/commonRules';
import { harnessRuleLimits } from '../../src/rules/explorer-ui/catalog';

/** Writes a source into the project folder and reads it back the way the audit collector does. */
async function projectFile(root: string, path: string, contents: string): Promise<AuditFile> {
	const absolutePath = join(root, path);
	await mkdir(dirname(absolutePath), { recursive: true });
	await writeFile(absolutePath, contents);
	const text = (await readFile(absolutePath)).toString('utf8');
	return {
		absolutePath,
		relativePath: relative(root, absolutePath),
		extension: extname(path).toLowerCase(),
		contents: text,
		lines: splitLines(text),
		structuralLines: splitLines(maskTemplateLiterals(text)),
		limits: harnessRuleLimits,
		size: Buffer.byteLength(text)
	};
}

/** Audits one source as the collector calls the adapter and keeps what was given and what came back. */
export async function auditCase(
	root: string,
	name: string,
	path: string,
	text: string
): Promise<Case> {
	const file = await projectFile(root, path, text);
	return { name, input: { path, contents: text }, output: cppAdapter.audit(file) };
}
