export type PeakMemory = { bytes: number } | { unavailable: string };

export { peakMemory } from '../cli/program/run-kernel-bench/kernel-benchmark-service/peakMemory';
