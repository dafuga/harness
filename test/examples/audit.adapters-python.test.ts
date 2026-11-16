import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { test } from 'vitest';
import { pythonAdapter } from '../../src/audit/development-tooling/adapters/python';
import type { AuditFile } from '../../src/audit/development-tooling/adapters/types';
import { maskTemplateLiterals, splitLines } from '../../src/audit/development-tooling/commonRules';
import { readAuditConfig } from '../../src/audit/development-tooling/config';
import { harnessRuleLimits } from '../../src/rules/explorer-ui/catalog';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * pythonAdapter.audit is called as the audit runner calls it: each Python file is written into a
 * temporary project folder, read back, and given an AuditFile whose limits come from
 * harness.audit.json. The adapter runs no tool (ruff is only declared optional) and reads no file,
 * so no fake executable is needed.
 */

const unitId = 'audit.adapters-python';
const evidence = 'examples-cases';
const finding = (path: string, rule: string, message: string) => ({ path, rule, message });
const auditRecord = (state: string, symbol = 'pythonAdapter.audit') => ({
	unitId,
	symbol,
	state,
	evidence,
	file: `${state}.json`
});

const loader = `import json


def load_settings(path, overrides={}):
    try:
        return {**json.load(open(path)), **overrides}
    except:
        return {}


def read_tags(text, seen=set(), extra=[]):
    try:
        return text.split(",")
    except Exception:
        return []
`;
const cache = `def read_cache(path, default=None):
    try:
        return path.read_text()
    except OSError:
        return default
`;
const rows = `class Row:
    name = ""


class Writer:
    def __init__(self, path):
        self.path = path
        self.rows = []

    def add(self, row):
        self.rows.append(row)
`;
const script = `def main():
    print("exported")
    return 0


main()
`;
const guarded = `def main():
    print("exported")
    return 0


if __name__ == "__main__":
    main()
`;
const pipeline = `import json


def build_report(title, rows, sort, limit, offset):
    page = sorted(rows, key=lambda row: row[sort])[offset:offset + limit]
    return {"title": title, "rows": page}


def render(report):
    lines = [report["title"]]
    for row in report["rows"]:
        lines.append(json.dumps(row))
    return "".join(lines)
`;
const paths = `from pathlib import Path


def project_path(root, name):
    return Path(root) / name
`;

function writeProject(root: string, files: Record<string, string>): void {
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
}

/** Audits one file of the project as the runner does, keeping what it was given beside its findings. */
function audited(root: string, relativePath: string, limits = readAuditConfig(root).limits) {
	const contents = readFileSync(join(root, relativePath), 'utf8');
	const file: AuditFile = {
		absolutePath: join(root, relativePath),
		relativePath,
		extension: extname(relativePath),
		contents,
		lines: splitLines(contents),
		structuralLines: splitLines(maskTemplateLiterals(contents)),
		limits,
		size: Buffer.byteLength(contents)
	};
	return { input: { relativePath, contents, limits }, output: pythonAdapter.audit(file) };
}

test('Flags broad except clauses and mutable default arguments', async () => {
	await withTempDir('audit-python-adapter-', async (root) => {
		writeProject(root, { 'src/tools/loader.py': loader, 'src/tools/cache.py': cache });
		const loaded = audited(root, 'src/tools/loader.py');
		const cached = audited(root, 'src/tools/cache.py');
		const path = 'src/tools/loader.py';
		expect(loaded.output).toEqual([
			finding(path, 'python-broad-exception', 'Catch specific Python exceptions.'),
			finding(path, 'python-mutable-default', 'Avoid mutable Python default arguments.')
		]);
		expect(cached.output).toEqual([]);
		recordExampleCases(auditRecord('flags-broad-except-clauses-and-mutable-default-arguments'), [
			{ name: 'bare except and except Exception, with {}, set() and [] defaults', ...loaded },
			{ name: 'specific except and a None default, so nothing is flagged', ...cached }
		]);
	});
});

test('Flags a class longer than its maxClassLines limit', async () => {
	await withTempDir('audit-python-adapter-', async (root) => {
		const config = JSON.stringify({ limits: { maxClassLines: 4 } });
		writeProject(root, { 'harness.audit.json': config, 'src/tools/rows.py': rows });
		const configured = audited(root, 'src/tools/rows.py');
		const defaulted = audited(root, 'src/tools/rows.py', harnessRuleLimits);
		expect(configured.output).toEqual([
			finding(
				'src/tools/rows.py',
				'small-class',
				'Python class near line 5 has 8 lines. Limit is 4.'
			)
		]);
		expect(defaulted.output).toEqual([]);
		recordExampleCases(auditRecord('flags-a-class-longer-than-its-maxclasslines-limit'), [
			{
				name: 'Writer has 8 lines against a maxClassLines of 4; Row is at the limit',
				...configured
			},
			{ name: 'the same module under the default maxClassLines of 120', ...defaulted }
		]);
	});
});

test('Flags scripts/ files without a __main__ guard', async () => {
	await withTempDir('audit-python-adapter-', async (root) => {
		writeProject(root, {
			'scripts/export_report.py': script,
			'scripts/check_links.py': guarded,
			'src/tools/export_report.py': script
		});
		const unguarded = audited(root, 'scripts/export_report.py');
		const withGuard = audited(root, 'scripts/check_links.py');
		const outside = audited(root, 'src/tools/export_report.py');
		const path = 'scripts/export_report.py';
		expect(unguarded.output).toEqual([
			finding(path, 'python-entrypoint-guard', 'Python scripts should use a __main__ guard.')
		]);
		expect(withGuard.output).toEqual([]);
		expect(outside.output).toEqual([]);
		recordExampleCases(auditRecord('flags-scripts-files-without-a-main-guard'), [
			{ name: 'scripts/ file that calls main at import, with no __main__ guard', ...unguarded },
			{ name: 'scripts/ file with an if __name__ == "__main__" guard', ...withGuard },
			{ name: 'the same unguarded code outside scripts/ is not checked', ...outside }
		]);
	});
});

test('Includes the file length and indented block checks', async () => {
	await withTempDir('audit-python-adapter-', async (root) => {
		const limits = { maxFileLines: 12, maxFunctionLines: 4, maxParameters: 3 };
		writeProject(root, {
			'harness.audit.json': JSON.stringify({ limits }),
			'src/tools/pipeline.py': pipeline,
			'src/tools/paths.py': paths
		});
		const piped = audited(root, 'src/tools/pipeline.py');
		const pathed = audited(root, 'src/tools/paths.py');
		const path = 'src/tools/pipeline.py';
		expect(piped.output).toEqual([
			finding(path, 'small-file', 'File has 14 lines. Limit is 12. Split it by responsibility.'),
			finding(path, 'small-function', 'Block starting near line 4 has 5 lines. Limit is 4.'),
			finding(path, 'max-parameters', 'Block starting near line 4 has 5 parameters. Limit is 3.'),
			finding(path, 'small-function', 'Block starting near line 9 has 6 lines. Limit is 4.')
		]);
		expect(pathed.output).toEqual([]);
		recordExampleCases(auditRecord('includes-the-file-length-and-indented-block-checks'), [
			{ name: 'a 14-line module whose 5-line def takes five parameters', ...piped },
			{ name: 'a short module with a two-parameter function, under the same limits', ...pathed }
		]);
	});
});

test('Declares the Python id, label, profiles, extensions and tools', () => {
	const { id, label, profiles, extensions, optionalTools } = pythonAdapter;
	const declared = { id, label, profiles, extensions, optionalTools };
	expect(declared).toEqual({
		id: 'python',
		label: 'Python',
		profiles: ['lib'],
		extensions: ['.py'],
		optionalTools: ['ruff']
	});
	recordExampleCases(
		auditRecord('declares-the-python-id-label-profiles-extensions-and-tools', 'pythonAdapter'),
		[
			{
				name: 'the exported pythonAdapter, read for the fields it declares',
				input: { export: 'pythonAdapter' },
				output: declared
			}
		]
	);
});
