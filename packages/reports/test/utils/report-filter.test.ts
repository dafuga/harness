import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import type { Evidence, Report } from '../../src/models/Report.types';
import { reportFilter as componentReportFilter } from '../../src/components/evidence-grid/reportFilter';
import { reportFilter as canonicalReportFilter } from '../../src/components/verification-evidence/evidence-grid/reportFilter';
import {
	reportFilter as utilityReportFilter,
	screenSize,
	galleryEvidence,
	projectFilter
} from '../../src/utils/reportFilter';
import {
	reportFilter as verificationReportFilter,
	screenSize as canonicalScreenSize,
	galleryEvidence as canonicalGalleryEvidence,
	projectFilter as canonicalProjectFilter
} from '../../src/utils/verification-evidence/reportFilter';
import { audioPairs } from '../../src/utils/audioPairs';
import type { Filters } from '../../src/utils/verification-evidence/reportFilter.types';
import manifest from '../../../../specification/units/reports.function.report-filter.json';

type PairEntries = Array<[string, Evidence]>;

function pairMap(value: unknown): ReadonlyMap<string, Evidence> | undefined {
	return value === undefined ? undefined : new Map(value as PairEntries);
}

function assertPublicForwarders(): void {
	expect(componentReportFilter).toBe(canonicalReportFilter);
	expect(utilityReportFilter).toBe(canonicalReportFilter);
	expect(verificationReportFilter).toBe(canonicalReportFilter);
	expect(screenSize).toBe(canonicalScreenSize);
	expect(galleryEvidence).toBe(canonicalGalleryEvidence);
	expect(projectFilter).toBe(canonicalProjectFilter);
}

function invokeScreenSize(...input: never[]) {
	assertPublicForwarders();
	const [item] = input as unknown as [Evidence];
	return screenSize(item);
}

function invokeGalleryEvidence(...input: never[]) {
	assertPublicForwarders();
	const [items, entries] = input as unknown as [Evidence[], PairEntries?];
	const pairs = pairMap(entries);
	return pairs ? galleryEvidence(items, pairs) : galleryEvidence(items);
}

function invokeReportFilter(...input: never[]) {
	assertPublicForwarders();
	const [items, filter, entries] = input as unknown as [Evidence[], Filters, PairEntries?];
	const pairs = pairMap(entries);
	if (!pairs) return componentReportFilter(items, filter);
	const source = [...items, ...pairs.values()];
	const actualPairs = audioPairs(source);
	expect([...actualPairs]).toEqual([...pairs]);
	const gallery = galleryEvidence(source, actualPairs);
	expect(gallery).toEqual(items);
	return componentReportFilter(gallery, filter, actualPairs);
}

function invokeProjectFilter(...input: never[]) {
	assertPublicForwarders();
	const [run, query, project] = input as unknown as [Report, string, string];
	return projectFilter(run, query, project);
}

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	screenSize: invokeScreenSize,
	galleryEvidence: invokeGalleryEvidence,
	reportFilter: invokeReportFilter,
	projectFilter: invokeProjectFilter
});
