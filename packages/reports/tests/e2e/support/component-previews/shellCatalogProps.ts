import type { PreviewCases } from './shared';
import { shellBasicProps } from './shellBasicProps';
import { shellNavProps } from './shellNavProps';
import { shellEntityProps } from './shellEntityProps';
import { shellExplorerProps } from './shellExplorerProps';

/** The real component is retained; catalog states change only its caller inputs. */
export function shellCatalogProps(id: string, props: PreviewCases[string], variant: string) {
	const basic = shellBasicProps[id] ?? shellNavProps[id];
	return basic
		? basic(props, variant)
		: (shellEntityProps(id, props, variant) ?? shellExplorerProps(id, props, variant));
}
