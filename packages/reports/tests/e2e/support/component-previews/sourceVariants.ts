import type { PreviewCases } from './shared';

/** Preserve the source-preview loading, error, empty and linked examples. */
export function sourceVariant(props: PreviewCases[string], id: string, variant: string) {
	if (id === 'reports.component.source-code-action') return sourceActionVariant(props, variant);
	if (id === 'reports.component.source-file-list') return sourceFileListVariant(props, variant);
	if (id === 'reports.component.source-viewer') return sourceViewerVariant(props, variant);
	return sourceReaderVariant(props, variant);
}

function sourceActionVariant(props: PreviewCases[string], variant: string) {
	if (variant !== 'unavailable') return props;
	const nav = props.nav as Record<string, unknown>;
	return { ...props, nav: { ...nav, source: undefined } };
}

function sourceReaderVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'loading') return { ...props, files: pendingSourceFiles };
	if (variant === 'error') return { ...props, read: unavailableSource };
	return {
		...props,
		files: async () => [],
		empty: 'No archived source was recorded for this revision.'
	};
}

function sourceFileListVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'linked')
		return {
			...props,
			href: (path: string) => `https://github.com/example/orders/blob/main/${path}`,
			relativeTo: 'src/'
		};
	return {
		...props,
		files: [],
		empty: 'No archived source files were recorded for this revision.'
	};
}

function sourceViewerVariant(props: PreviewCases[string], variant: string) {
	const state = props.state as Record<string, unknown>;
	if (variant === 'loading')
		return { ...props, state: { ...state, text: '', loading: true, error: '' } };
	if (variant === 'error')
		return { ...props, state: { ...state, text: '', loading: false, error: sourceUnavailable } };
	return {
		...props,
		state: { ...state, files: [], path: '', text: '', loading: false, error: '' },
		empty: 'No archived source was recorded for this revision.'
	};
}

const sourceUnavailable = 'Archived source is unavailable for this revision.';
const pendingSourceFiles = () => new Promise<string[]>(() => {});
const unavailableSource = async () => {
	throw new Error(sourceUnavailable);
};
