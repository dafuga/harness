import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { appStyleTokensConfig } from '../../../src/configs/shared-primitives/appStyleTokensConfig';

/** The actual shared registry, so adding a token requires catalog coverage without a stale count. */
export function declaredStyleTokens(): string[] {
	const root = resolve(import.meta.dirname, '../../../../..');
	const names = new Set<string>();
	postcss
		.parse(readFileSync(resolve(root, appStyleTokensConfig.tokenFile), 'utf8'))
		.walkDecls((declaration) => {
			if (declaration.prop.startsWith('--hx-')) names.add(declaration.prop);
		});
	return [...names].sort();
}
