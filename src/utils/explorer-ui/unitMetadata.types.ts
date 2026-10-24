import { type HelperConsumer } from './helperConsumers';
import type { ExportedSymbol } from '../../core/development-tooling/sourceTypes';
import type { z } from 'zod';
import type { usageExampleSchema } from '../../core/development-tooling/unitTypes';
import { type UnitDocumentation } from './unit-documentation/unitDocumentation';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';

export interface PublicHelper extends Pick<ExportedSymbol, 'name' | 'inputs' | 'output'> {
	source: string;
	/** This callable's implementation folder, independent of its owning module. */
	group?: UnitMetadata['group'];
	examples?: z.infer<typeof usageExampleSchema>[];
	/** Explicit @pure source contract accepted by the conservative effect guard. */
	pure?: boolean;
	consumers?: HelperConsumer[];
}

export interface PublicServiceClass {
	source: string;
	name: string;
	methods: string[];
	constructedBy: HelperConsumer[];
	consumers: HelperConsumer[];
}

export interface UnitMetadata {
	composition?: ComponentManifest['composition'];
	/** Public model declarations and static storage definitions from this exact revision. */
	modelDefinitions?: ModelDefinition[];
	/** Committed initializer expressions, never values read from the host environment. */
	configValues?: ConfigVariable[];
	sourceFiles?: SourceFileSnapshot[];
	/** Associated tests from direct imports or authored scenarios at this revision. */
	testFiles?: SourceFileSnapshot[];
	catalog?: { visibility: 'public' | 'internal' };
	group?: { id: string; title: string };
	documentation?: UnitDocumentation;
	helpers?: PublicHelper[];
	/** Runtime exports and their distinct owning code units at this exact revision. */
	serviceExports?: Array<{ source: string; name: string }>;
	serviceConsumers?: HelperConsumer[];
	/** Concrete declarations, instance methods and constructor references from this revision. */
	serviceClasses?: PublicServiceClass[];
	helperGap?: string;
}

export interface ModelDefinition {
	name: string;
	kind: 'class' | 'interface' | 'type';
	source: string;
	type?: string;
	fields: Array<{ name: string; type: string; optional: boolean }>;
	methods: Array<{
		name: string;
		inputs: Array<{ name: string; type: string }>;
		output: string;
	}>;
	table?: ModelTable;
	tableGap?: string;
}

export interface ModelTable {
	name: string;
	primaryKey: string;
	columns: Array<{
		property: string;
		name: string;
		type: string;
		nullable: boolean;
		primaryKey: boolean;
		default?: string;
	}>;
}

/** A source expression or a statically inspectable collection; no initializer is executed. */
export type ConfigValueNode =
	| { kind: 'expression'; source: string }
	| {
			kind: 'object' | 'array';
			source: string;
			entries: Array<{ name: string; node: ConfigValueNode }>;
			/** Exact immediate key/item count; omitted for spreads or schema-defined array lengths. */
			count?: number;
			schema?: boolean;
	  };

export interface ConfigVariable {
	structure?: ConfigValueNode;
	name: string;
	value: string;
	source: string;
	/** Decoded static literal only; computed expressions are never evaluated. */
	literal?: unknown;
}

export interface SourceFileSnapshot {
	path: string;
	/** Committed text stored under the existing protected history media endpoint. */
	media: string | null;
	gap?: string;
}
