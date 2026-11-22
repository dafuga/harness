# Plain Docker session performance on MB2

This benchmark repeats the run-112 Harness worker fixture on macOS and in a plain
Linux Docker container on the same Apple silicon Mac. The target is less than 5%
suite overhead against the native run in the same round. The final seven
rounds put Docker-only session suite time 13.3% below native on fresh launches
and 12.3% below native with prewarming.

## Workload and measurement

- Harness revision `282bc509619f7a5fb5af9695c682b1802fbc9c29` with the original
  worker fixture and profiler. The fixture runs `harness task worker --once`,
  starts a synthetic provider, and verifies that the task reaches review.
- The provider runs five test files with one Vitest worker and 14 tests.
  Native macOS and Linux arm64 both use Node 26.13.0 and Bun 1.2.18 and install
  their platform dependencies from the same frozen lockfile.
- Measurements are serial. Each round includes a native control and rotates the
  order of the variants in the configuration phases. The original bind baseline
  ran native first in each pair. Tables report medians with minimum and maximum
  in brackets. Paired overhead is the median of the percentages computed within
  each round. Later phases sampled peer test-program CPU before starting each
  run to leave headroom on the shared host.
- Launch ends at the first profiler marker. Driver time covers the outer Vitest
  process. Worker-ready starts when the fixture invokes the Harness worker.
  Suite time covers the inner Vitest invocation through output collection.
  Image, dependency, and container prewarm costs are accounted for separately.
- CPU is child user plus system time. RSS is the peak of process-tree RSS sums
  sampled every 150 ms. The Linux cgroup peak covers a different scope.
  The I/O check writes and fsyncs 64 MiB in the checkout, then reads and hashes
  it. Every completed sample matches the original digest.

The Node and Bun image inputs used Linux arm64 manifest digests
`sha256:a0b93c08df51926b62df52fb9f7bba8a9b52e42541e1532407b3cb366470c893`
and `sha256:6f69a9de61cb23bb0d6c7d76a3f4bb6c4fb5ad4bad72979b9e2fa74bf1140b1f`.
The historical baseline already used Linux arm64, so the repeat held architecture
fixed.

## Bind baseline

Docker Desktop Engine 29.4.0 on macOS 26.3.1. Both checkouts and test temporary
directories used task-owned host paths. The container had 2 CPU and 6 GiB limits.

| Measurement                  | Native median [min, max] | Bind Docker median [min, max] |
| ---------------------------- | -----------------------: | ----------------------------: |
| Profiler launch, ms          |              35 [33, 40] |                216 [214, 259] |
| Worker to provider-ready, ms |     1,158 [1,152, 1,196] |          1,029 [1,016, 1,058] |
| Suite, ms                    |     2,072 [2,029, 2,148] |          2,507 [2,433, 2,531] |
| Outer driver, ms             |     6,031 [6,000, 6,142] |          7,136 [6,873, 7,668] |
| CPU, CPU-s                   |        8.11 [8.01, 8.21] |             8.15 [7.92, 9.31] |
| Process-tree RSS peak, MiB   |           891 [870, 896] |                914 [909, 927] |
| 64 MiB fsync, ms             |              37 [16, 72] |                   51 [45, 72] |
| 64 MiB read and SHA-256, ms  |              35 [34, 37] |                   61 [59, 68] |

Over five fresh pairs the bind-backed container added **20.5% [16.6%, 24.8%]**
suite time and **182 ms [178, 218]** of launch time. CPU time was nearly flat.
The provider reached ready sooner inside Docker, while the suite and the rest of
the outer driver took longer.

## Docker Desktop storage

The dependency variant mounts root `node_modules` and the Bun cache as
named volumes. The full variant moves the checkout and its workspace
dependencies into an ext4 volume. The tmpfs variant places test temporary
files on a 512 MiB per-container mount. The fixture executes programs from its
temporary directory, so this mount uses `exec,nosuid,nodev`. Docker Desktop
reported `fakeowner` for the host binds and `ext4` for named volumes.
[Docker tmpfs mount options](https://docs.docker.com/engine/storage/tmpfs/)

| Layout                                       |            Suite, ms | Paired suite vs native, % |   Profiler launch, ms |      Outer driver, ms |
| -------------------------------------------- | -------------------: | ------------------------: | --------------------: | --------------------: |
| Native control                               | 1,990 [1,939, 2,064] |            0.0 [0.0, 0.0] |           41 [34, 80] | 6,161 [5,851, 37,912] |
| Bind workspace and temp                      | 2,262 [2,247, 2,391] |         16.1 [12.9, 18.0] |     879 [228, 38,805] |  6,610 [6,500, 8,014] |
| Root dependencies and Bun cache volumes      | 1,946 [1,930, 2,058] |          -0.1 [-6.0, 1.6] | 5,598 [1,589, 23,675] |  5,625 [5,578, 5,988] |
| Dependency volumes plus tmpfs                | 1,876 [1,858, 1,992] |         -3.5 [-7.7, -1.0] |   4,831 [345, 19,592] |  5,354 [5,265, 5,520] |
| Checkout, dependencies and Bun cache volumes | 1,859 [1,776, 2,264] |         -6.6 [-8.6, 16.8] |    3,320 [824, 8,463] |  5,314 [5,098, 5,568] |
| Checkout and cache volumes plus tmpfs        | 1,737 [1,709, 1,769] |       -11.9 [-16.4, -8.8] |    5,261 [778, 9,866] |  4,888 [4,845, 4,939] |
| Same volumes and tmpfs, prewarmed exec       | 1,754 [1,668, 1,808] |       -11.9 [-16.7, -8.7] |          98 [81, 110] |  4,938 [4,792, 4,983] |

All 35 workload runs passed all 14 tests. Moving dependencies improved suite
time even with the checkout on a bind. Moving the full workspace and test temp
files reduced both suite and driver time. Separate storage phases ran at
different times on the shared host. Use each phase's matched native control.

| Layout                                       | Driver CPU, CPU-s | Peak process-tree RSS, MiB | 64 MiB fsync, ms | 64 MiB read and hash, ms |
| -------------------------------------------- | ----------------: | -------------------------: | ---------------: | -----------------------: |
| Native control                               | 7.80 [7.69, 8.14] |             908 [851, 938] |      43 [20, 61] |              34 [33, 34] |
| Bind workspace and temp                      | 7.76 [7.51, 8.13] |             916 [906, 961] |      57 [47, 81] |              60 [56, 62] |
| Root dependencies and Bun cache volumes      | 7.18 [7.06, 7.50] |             924 [917, 962] |      68 [45, 84] |              62 [60, 69] |
| Dependency volumes plus tmpfs                | 7.08 [6.97, 7.27] |             968 [921, 969] |      47 [46, 66] |              61 [60, 64] |
| Checkout, dependencies and Bun cache volumes | 7.06 [6.73, 7.76] |             923 [909, 977] |      49 [44, 79] |              44 [42, 48] |
| Checkout and cache volumes plus tmpfs        | 6.82 [6.71, 6.88] |             930 [918, 963] |      46 [41, 56] |              43 [41, 45] |
| Same volumes and tmpfs, prewarmed exec       | 6.88 [6.77, 6.92] |             918 [888, 930] |      47 [38, 53] |              43 [39, 44] |

An initial tmpfs attempt failed before the suite because the fixture's
temporary provider executable could not run. After adding the explicit
`exec` mount option, the same fixture and suite passed. One earlier
dependency-volume attempt hit a Git object lookup failure in its bind-backed
test temp directory. The incomplete rounds are retained as diagnostics outside
the paired sample table.

## Container limits

The Docker Desktop VM exposed 10 vCPUs and approximately 31 GiB of RAM. The
comparison below varied the session's cgroup quota while keeping checkout
volumes and tmpfs constant.

| Container quota |            Suite, ms | Paired suite vs native, % | Driver CPU, CPU-s | Peak process-tree RSS, MiB |
| --------------- | -------------------: | ------------------------: | ----------------: | -------------------------: |
| Native control  | 1,930 [1,916, 2,047] |            0.0 [0.0, 0.0] | 7.88 [7.66, 8.04] |             866 [842, 932] |
| 2 CPU, 6 GiB    | 1,712 [1,684, 1,806] |      -11.3 [-12.7, -10.9] | 6.80 [6.57, 6.99] |             926 [906, 958] |
| 3 CPU, 6 GiB    | 1,735 [1,699, 1,894] |       -11.7 [-15.6, -1.2] | 6.94 [6.66, 7.30] |             917 [915, 935] |
| 2 CPU, 8 GiB    | 1,736 [1,684, 1,889] |       -10.0 [-16.1, -1.4] | 6.86 [6.66, 7.21] |             918 [906, 973] |

The tested suite fit comfortably at 2 CPU and 6 GiB. Increasing either
limit returned similar timings. All five attempts at 1 CPU failed before
the provider wrote its receipt. A direct admission probe confirmed that a
1-CPU request exceeded usable capacity after the default 10% CPU reserve.
The same probe passed in a 2-CPU container. Run-112 recorded the analogous
4 GiB memory admission failure, with 2 GiB requested and 2 GiB reserved.

## Launch and prewarming

The Docker-only variant puts the original profiler in a read-only volume, uses
tmpfs for the fixture home and receipts, and returns the receipts over standard
output. The checkout and Bun cache stay on Docker volumes. This removes the
remaining host binds from the volume-and-tmpfs configuration.

| Layout                                           |  Create, ms |   Attached start, ms | Launch to profiler, ms | Paired launch vs native, ms | Paired suite vs native, % |
| ------------------------------------------------ | ----------: | -------------------: | ---------------------: | --------------------------: | ------------------------: |
| Native control                                   |           — |                    — |            34 [33, 39] |                    0 [0, 0] |            0.0 [0.0, 0.0] |
| Volumes and tmpfs with support binds             |           — |                    — |     1,428 [245, 8,619] |          1,393 [213, 8,585] |      -12.3 [-14.0, -11.4] |
| Same storage, create and attach timed separately | 33 [33, 35] | 5,904 [1,323, 9,174] |   5,938 [1,357, 9,206] |        5,905 [1,322, 9,171] |       -13.7 [-14.9, -6.7] |
| Docker-only mounts, fresh container              | 31 [30, 33] |        100 [97, 102] |         130 [126, 136] |                96 [91, 101] |       -12.0 [-13.6, 26.7] |
| Docker-only mounts, prewarmed exec               |           — |                    — |            69 [62, 76] |                 35 [25, 42] |       -11.5 [-14.6, -8.2] |

The attached start accounted for the measured launch tail with support binds.
Docker-only launch narrowed that spread to 126–136 ms across the five fresh
containers. One of those runs had +26.7% suite overhead with peer programs
using about one core when the sample started. The table includes that run.

Preparing the Docker-only warm container took 111 [99, 123] ms for boot and
61 [53, 78] ms to prime the runtimes. The combined preparation and launch was
244 [227, 253] ms. The 69 ms exec figure applies once the container is ready.

## Image and dependency preparation

Provisioning times are outside the suite and profiler-launch measurements.
The cached Desktop image build took 1.18 s, with both Dockerfile layers
reported as cached. The resulting 1.25 GB logical image was available before
each Desktop trial. Cold dependency installs used empty Bun caches. Warm
install comparisons started with fresh source and empty dependency folders,
reused the corresponding populated cache, and ran offline.

| Prepared workspace                       | Cold install, s (one run) | Warm-cache install, s (median [min, max]) |
| ---------------------------------------- | ------------------------: | ----------------------------------------: |
| Native macOS                             |                     11.59 |                                         — |
| Docker workspace and cache on host binds |                     29.34 |                      20.33 [19.96, 20.34] |
| Root dependency and Bun cache volumes    |                     14.11 |                                         — |
| Docker checkout and Bun cache volumes    |                     11.95 |                         2.29 [1.74, 2.75] |

Staging clean source for the warm-cache comparison took 2.68 s
[2.65, 3.60] to a host directory or 2.73 s [2.30, 2.91] to a Docker
volume. Volume seeding normalizes the checkout owner to the runtime UID
before the nonroot install.

Exporting the prebuilt runtime image took 14.08 s. Loading it into the empty
private Docker engine took 10.87 s. The Desktop and private engine image IDs
differed, and their root filesystem layer digests matched exactly. Transferring
the prepared checkout volume took 23.34 s to export and 3.69 s to import.

## Isolation

Every measured container had a read-only root, a nonroot user, dropped
capabilities, disabled privilege escalation, and an isolated network namespace.
Probe receipts verified the effective capabilities, root mount flags, writable
fixture paths, and the absence of a Docker socket and host home. The Docker-only
variant also verified zero host binds and read-only profiler storage. Preparation
used public locked dependencies with a disposable package cache. Measured
sessions used a synthetic provider and a task-owned workspace.

## VirtioFS and private VM sizing

A task-owned Colima 0.10.1 VM ran Docker Engine 29.2.1 with Apple
Virtualization and VirtioFS. The resize operations were confined to that
private VM. Each of the three rounds per size used the same image
layers, checkout and 2 CPU / 6 GiB session cap. The mount probes identified
the host binds as VirtioFS and Docker volumes as ext4. Engine and VM
differences also affect comparisons with Docker Desktop.

| VM allocation  | VirtioFS bind suite, % vs native | Volume and tmpfs suite, % vs native | Bind launch, ms | Volume and tmpfs launch, ms |
| -------------- | -------------------------------: | ----------------------------------: | --------------: | --------------------------: |
| 2 vCPU, 8 GiB  |                37.1 [22.7, 42.1] |                 -13.3 [-17.6, -9.6] |   128 [95, 136] |              111 [102, 120] |
| 3 vCPU, 8 GiB  |                46.2 [45.2, 63.1] |                  -9.4 [-12.9, -8.7] |   116 [97, 173] |               100 [95, 100] |
| 3 vCPU, 10 GiB |                50.7 [48.3, 54.7] |                -14.7 [-18.6, -11.8] |  114 [108, 176] |              173 [102, 180] |

VirtioFS kept launch times below the multi-second Desktop bind tail in these
trials. The suite still ran faster with the checkout in a Docker volume.
Larger private VM settings supplied no consistent suite benefit.

## Final confirmation

Seven additional Desktop rounds compared the Docker-only layout with fresh
native and bind controls. Each run passed all 14 tests.

| Layout                  |            Suite, ms | Paired suite vs native, % |       Launch, ms | Paired launch vs native, ms |  Driver CPU, CPU-s | Peak tree RSS, MiB |
| ----------------------- | -------------------: | ------------------------: | ---------------: | --------------------------: | -----------------: | -----------------: |
| Native control          | 2,201 [2,010, 2,319] |            0.0 [0.0, 0.0] |      35 [33, 42] |                    0 [0, 0] |  8.38 [7.90, 8.83] |     918 [720, 941] |
| Bind workspace and temp | 2,699 [2,411, 3,160] |         19.8 [18.0, 36.3] | 556 [254, 1,535] |            523 [212, 1,497] | 8.66 [7.98, 10.62] |     911 [903, 972] |
| Docker-only, fresh      | 1,826 [1,772, 2,037] |       -13.3 [-21.5, -7.4] |   148 [129, 172] |               113 [96, 138] |  7.17 [6.89, 7.78] |     921 [915, 973] |
| Docker-only, prewarmed  | 1,867 [1,762, 2,199] |       -12.3 [-17.6, -5.2] |     85 [62, 109] |                 51 [24, 74] |  7.18 [6.83, 7.73] |     924 [906, 970] |

The measured configuration uses a prebuilt Linux arm64 image, 2 CPU / 6 GiB,
Docker-owned workspace and dependency storage, and bounded tmpfs. These
results qualify the pinned synthetic worker and suite. A managed task
with live credentials and host-visible Git checkpoints has its own
integration requirements.

[Per-run metrics and resource measurements](samples.csv)
