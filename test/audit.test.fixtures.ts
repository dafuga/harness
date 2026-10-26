import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function designArtifactFixtures(root: string) {
	const base = 'specification/features/planned';
	const valid = ['png', 'jpg', 'jpeg', 'webp'].map(
		(extension) => `${base}/checkout-flow/desktop-option.${extension}`
	);
	const invalid = [
		`${base}/checkout-flow/desktop-option.gif`,
		`${base}/checkout-flow/desktop-option.svg`,
		`${base}/checkout-flow/desktop-option.txt`,
		`${base}/checkout-flow/BadName.png`,
		`${base}/BadFeature/desktop-option.png`,
		`${base}/orphan-feature/desktop-option.png`,
		`${base}/checkout-flow/nested/desktop-option.png`,
		`${base}/desktop-option.png`,
		'specification/features/desktop-option.png'
	];
	for (const path of [...valid, ...invalid, `${base}/checkout-flow.md`]) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(
			join(root, path),
			path.endsWith('.md') ? '# Checkout flow\n' : new Uint8Array([0])
		);
	}
	return { valid, invalid };
}

export async function scaffoldNamingFixtures(root: string) {
	await mkdir(join(root, 'src/services'), { recursive: true });
	await mkdir(join(root, 'src/utils'), { recursive: true });
	await mkdir(join(root, 'src/concerns'), { recursive: true });
	await mkdir(join(root, 'src/configs'), { recursive: true });
	await mkdir(join(root, 'db/migrations'), { recursive: true });

	const fixtures = {
		'src/services/post-service.ts':
			"export class PostService {\n\trun(): string {\n\t\treturn 'ok';\n\t}\n}\n",
		'src/utils/format-date.ts':
			'export function format_date(value: string): string {\n\treturn value;\n}\n',
		'src/utils/configValue.types.ts': 'export interface ConfigValue { literal?: unknown; }\n',
		'src/concerns/publishable.ts':
			'export function publishable<T extends object>(input: T): T {\n\treturn input;\n}\n',
		'db/migrations/CreatePosts.sql': '-- reversible: ok\n',
		'src/configs/bad-config.ts': 'export const badConfig = { enabled: true };\n'
	};
	for (const [file, source] of Object.entries(fixtures)) await writeFile(join(root, file), source);
}
