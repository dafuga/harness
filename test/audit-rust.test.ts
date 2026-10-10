import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { auditProject } from '../src/audit/audit';

const long = (lines: number) =>
	[
		'pub fn long() -> u32 {',
		...Array.from({ length: lines }, () => '    let _ = 1;'),
		'    1',
		'}',
		''
	].join('\n');

async function audit(files: Record<string, string>, profile: 'lib' | 'app' = 'lib') {
	const root = await mkdtemp(join(tmpdir(), 'harness-rust-'));
	try {
		for (const [path, contents] of Object.entries(files)) {
			await mkdir(join(root, path, '..'), { recursive: true });
			await writeFile(join(root, path), contents);
		}
		return await auditProject(root, { profile });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

test('Rust sources are covered by the audit instead of reported as unknown', async () => {
	const result = await audit({
		'crates/demo/src/lib.rs': 'pub fn add(a: u32, b: u32) -> u32 {\n    a + b\n}\n'
	});
	expect(result.findings).toEqual([]);
	expect(result.coverage.unknownFiles).toEqual([]);
	const rust = result.coverage.adapters.find((adapter) => adapter.id === 'rust');
	expect(rust).toMatchObject({
		files: ['crates/demo/src/lib.rs'],
		optionalTools: ['cargo fmt', 'cargo clippy']
	});
	const app = await audit({ 'crates/demo/src/lib.rs': 'pub fn add() {}\n' }, 'app');
	expect(app.coverage.unknownFiles).toEqual(['crates/demo/src/lib.rs']);
});

test('Rust functions and files obey the Harness size limits', async () => {
	const result = await audit({
		'crates/demo/src/lib.rs': long(60),
		'crates/demo/src/big.rs': Array.from(
			{ length: 230 },
			(_, index) => `pub const V${index}: u32 = 1;`
		).join('\n'),
		'crates/demo/src/args.rs':
			'fn many(a: u8, b: u8, c: u8, d: u8, e: u8) -> u8 {\n    a + b + c + d + e\n}\n'
	});
	expect(result.findings.map((finding) => [finding.path, finding.rule]).sort()).toEqual([
		['crates/demo/src/args.rs', 'max-parameters'],
		['crates/demo/src/big.rs', 'small-file'],
		['crates/demo/src/lib.rs', 'small-function']
	]);
});

test('unsafe Rust must state why it is sound', async () => {
	const undocumented = 'pub fn read(ptr: *const u8) -> u8 {\n    unsafe { *ptr }\n}\n';
	const documented =
		'pub fn read(ptr: *const u8) -> u8 {\n    // SAFETY: the caller passes a valid pointer.\n    unsafe { *ptr }\n}\n';
	const result = await audit({
		'crates/demo/src/a.rs': undocumented,
		'crates/demo/src/b.rs': documented
	});
	expect(result.findings).toEqual([
		{
			path: 'crates/demo/src/a.rs',
			rule: 'rust-unsafe-comment',
			message: 'Unsafe code near line 2 needs a preceding // SAFETY: comment.'
		}
	]);
});
