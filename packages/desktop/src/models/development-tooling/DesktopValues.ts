export type {
	DesignImage,
	DesignOptionInfo,
	DesignRevision,
	DesignVersion
} from '../DesignVersion.types';
/**
 * What the Electron main process tells the renderer about a project. Every value here is
 * serializable: it crosses the preload bridge by structured clone.
 */
export const categories = [
	'pages',
	'apis',
	'layouts',
	'components',
	'functions',
	'configs',
	'services',
	'models'
] as const;
