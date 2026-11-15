import { expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { VideoPlan } from '../../src/services/verification-evidence/VideoEvidenceService.types';
import { VideoEvidenceService } from '../../src/services/verification-evidence/VideoEvidenceService';
import { withTempDir } from './temporary';
import { videoManifest, prepareVideoEvidence } from './videoEvidenceFixture';

/** Isolated config/style variants strengthen the existing planning method case. */
export async function assertVideoInputBindings(): Promise<VideoPlan> {
	await rootConfigBindings();
	await workspaceConfigBindings();
	const producer = await uncertainConfigBindings();
	await preprocessorBindings();
	return producer;
}

async function rootConfigBindings() {
	await withTempDir('harness-video-config-', async (root) => {
		await prepareVideoEvidence(root);
		await mkdir(join(root, 'config'));
		await writeFile(join(root, 'tsconfig.json'), '{ "extends": "./config/tsconfig.middle" }');
		await writeFile(
			join(root, 'config/tsconfig.middle.json'),
			'{ // JSONC\n "extends": "./base.json", }'
		);
		await writeFile(
			join(root, 'config/base.json'),
			'{ "compilerOptions": { "target": "ES2022" } }'
		);
		const service = new VideoEvidenceService(root),
			previous = service.plan(videoManifest).record;
		expect(previous[0].dependencies).toContain('config/base.json');
		await writeFile(
			join(root, 'config/base.json'),
			'{ "compilerOptions": { "target": "ESNext" } }'
		);
		expect(service.plan(videoManifest, previous).record).toHaveLength(4);
		await writeFile(join(root, 'config/base.json'), '{ "extends": "../tsconfig.json" }');
		expect(() => service.plan(videoManifest)).toThrow(/cycle/i);
		for (const reference of ['./config/missing', '../outside.json', '/etc/hosts', './.env.local']) {
			await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ extends: reference }));
			expect(() => service.plan(videoManifest)).toThrow(/missing|unsafe|escape|private/i);
		}
		await writeFile(join(root, '.env.local'), '{ "compilerOptions": { "strict": true } }');
		await symlink('../.env.local', join(root, 'config/private.json'));
		await writeFile(join(root, 'tsconfig.json'), '{ "extends": "./config/private" }');
		expect(() => service.plan(videoManifest)).toThrow(/unsafe|snapshot|private/i);
		expect(
			vi.mocked(readFileSync).mock.calls.some(([path]) => String(path).includes('.env.local'))
		).toBe(false);
	});
}

async function workspaceConfigBindings() {
	await withTempDir('harness-video-workspace-', async (root) => {
		await prepareVideoEvidence(root);
		await mkdir(join(root, 'config'));
		await writeFile(join(root, 'config/base.json'), '{ "compilerOptions": { "strict": true } }');
		for (const [id, workspace] of [
			['first', 'one'],
			['second', 'two']
		]) {
			await mkdir(join(root, `packages/${workspace}/src`), { recursive: true });
			await writeFile(join(root, `packages/${workspace}/package.json`), '{}');
			await writeFile(
				join(root, `packages/${workspace}/jsconfig.json`),
				JSON.stringify({ extends: workspace === 'one' ? ['../../config/base'] : [] })
			);
			await writeFile(
				join(root, `packages/${workspace}/src/${id}.ts`),
				'export const sample = true;'
			);
			await writeFile(
				join(root, `specification/units/component.${id}.json`),
				JSON.stringify({
					id: `component.${id}`,
					status: 'active',
					owns: { source: [`packages/${workspace}/src/${id}.ts`] },
					dependencies: []
				})
			);
		}
		const manifest = {
			...videoManifest,
			clips: videoManifest.clips.map((clip, index) => ({
				...clip,
				inputs: [`packages/${index ? 'two' : 'one'}/src/${clip.id}.ts`]
			}))
		};
		const service = new VideoEvidenceService(root),
			previous = service.plan(manifest).record;
		await writeFile(join(root, 'config/base.json'), '{ "compilerOptions": { "strict": false } }');
		const next = service.plan(manifest, previous);
		expect(next.record.map((slot) => slot.clipId)).toEqual(['first', 'first']);
		expect(next.reuse).toEqual(previous.filter((slot) => slot.clipId === 'second'));
	});
}

async function uncertainConfigBindings() {
	return withTempDir('harness-video-generated-', async (root) => {
		await prepareVideoEvidence(root);
		const service = new VideoEvidenceService(root);
		for (const reference of [
			'@tsconfig/unbound',
			{ unresolved: true },
			'./.generated/tsconfig.json'
		]) {
			await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ extends: reference }));
			const previous = service.plan(videoManifest).record;
			expect(previous[0].reasons?.join(' ')).toMatch(/extends.*recording required/i);
			expect(service.plan(videoManifest, previous).record).toHaveLength(4);
		}
		await writeFile(join(root, 'tsconfig.json'), '{ "extends": "./.svelte-kit/tsconfig.json" }');
		await writeFile(
			join(root, 'package.json'),
			JSON.stringify({
				scripts: { sync: 'svelte-kit sync' },
				devDependencies: { '@sveltejs/kit': '2.0.0' }
			})
		);
		await writeFile(join(root, 'svelte.config.js'), 'export default {};');
		await writeFile(join(root, 'bun.lock'), 'locked producer');
		await mkdir(join(root, 'static'));
		await writeFile(join(root, 'static/favicon.svg'), '<svg></svg>');
		await writeFile(join(root, 'src/app.html'), '<link href="%sveltekit.assets%/favicon.svg">');
		await mkdir(join(root, '.svelte-kit'));
		await writeFile(
			join(root, '.svelte-kit/tsconfig.json'),
			'invalid generated output must never be read'
		);
		const previous = service.plan(videoManifest).record;
		expect(previous[0].reasons?.join(' ')).toMatch(/SvelteKit.*producer/i);
		const warm = service.plan(videoManifest, previous);
		await writeFile(join(root, 'svelte.config.js'), 'export default { compilerOptions: {} };');
		expect(service.plan(videoManifest, previous).record).toHaveLength(4);
		return warm;
	});
}

async function preprocessorBindings() {
	await withTempDir('harness-video-preprocessor-', async (root) => {
		await prepareVideoEvidence(root);
		const service = new VideoEvidenceService(root);
		for (const extension of ['scss', 'sass', 'less', 'styl', 'stylus']) {
			await writeFile(join(root, 'src/first.ts'), `import './style.${extension}';`);
			await writeFile(join(root, `src/style.${extension}`), 'unresolved preprocessor syntax');
			const previous = service.plan(videoManifest).record;
			expect(previous[0].reasons?.join(' ')).toMatch(/preprocessor.*recording required/i);
			expect(service.plan(videoManifest, previous).record.map((slot) => slot.clipId)).toEqual([
				'first',
				'first'
			]);
		}
		await writeFile(join(root, 'src/first.ts'), "import './Styled.svelte';");
		await writeFile(
			join(root, 'src/Styled.svelte'),
			'<style lang="scss">p { background: url($unknown); }</style><p>Styled</p>'
		);
		const previous = service.plan(videoManifest).record;
		expect(previous[0].reasons?.join(' ')).toMatch(/preprocessor.*recording required/i);
		expect(service.plan(videoManifest, previous).record.map((slot) => slot.clipId)).toEqual([
			'first',
			'first'
		]);
	});
}
