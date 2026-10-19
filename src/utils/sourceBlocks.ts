

export interface SourceBlock {
	/** Function name, `Class.method`, or a `<module>`, `<template>` or `<style>` remainder. */
	name: string;
	kind: 'module' | 'function' | 'method' | 'template' | 'style';
	startLine: number;
	endLine: number;
	/** Comment- and whitespace-insensitive fingerprint of the block text. */
	hash: string;
	complexity: number;
}

export { sourceBlocks } from '../services/source-index-service/sourceBlocks';
