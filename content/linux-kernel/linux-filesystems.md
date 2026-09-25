---
title: "Linux Filesystems: From Disk and tmpfs to procfs"
weight: 21
date: 2026-10-19
draft: false
---

Directory paths in Linux do not indicate where data is physically stored.

To determine whether data is stored on disk, in memory, or generated dynamically by the kernel, you must inspect the filesystem type mounted at that path.

## Directories and Filesystems

A directory is a path within the Linux directory hierarchy:

```text
/
/tmp
/proc
/sys
```

A filesystem defines how data is organized, accessed, and managed.

Common filesystem types include:

- `ext4`
- `xfs`
- `tmpfs`
- `proc`
- `sysfs`

<span class="term-blue">The same directory may use different filesystem types on different systems.</span>

For example, `/tmp` may reside on a disk-based `ext4` filesystem or be mounted as `tmpfs`.

## Mount Points

Linux attaches a filesystem to a directory called a <mark>mount point</mark>.

```text
Filesystem  Mount point
ext4        /
tmpfs       /dev/shm
proc        /proc
sysfs       /sys
```

Therefore, the storage type cannot be determined from the directory name alone.

## Checking the Filesystem Type

Use `findmnt` to inspect a path:

```bash
findmnt /tmp
```

To inspect `/proc`:

```bash
findmnt /proc
```

The `FSTYPE` column indicates the filesystem type:

```text
TARGET SOURCE FSTYPE OPTIONS
/proc  proc   proc   rw,nosuid,nodev,noexec,relatime
```

To display all mounted filesystems:

```bash
findmnt
```

## Disk-Based Filesystems

Filesystems such as `ext4` and `xfs` are commonly created on disks or other block devices.

Their contents are persistent and normally remain available after a reboot.

Common disk-based filesystems include:

- `ext4`
- `xfs`
- `btrfs`
- `vfat`
- `ntfs`

Even when a file is stored on disk, Linux may cache recently accessed data in RAM through the page cache to improve performance.

## tmpfs

`tmpfs` is a filesystem backed by <mark>virtual memory</mark>.

<span class="term-blue">Its files consume virtual memory pages, and the number of allocated pages grows or shrinks as files are created, modified, or deleted.</span>

When swap is enabled, inactive memory pages belonging to `tmpfs` may be moved to swap space.

All data is lost when the `tmpfs` filesystem is unmounted.

Common mount points include:

```text
/dev/shm
/run
```

Some systems also mount `/tmp` as `tmpfs`, but the path alone is not sufficient to confirm this.

Use the following command:

```bash
findmnt /tmp
```

## Swap

Swap is disk space that can hold memory pages temporarily moved out of RAM.

When those pages are needed again, the kernel reads them back into RAM.

Because disk storage is slower than RAM, frequent swap activity can reduce system performance.

Since `tmpfs` may use swap, its data is not guaranteed to remain exclusively in physical RAM.

## procfs and /proc

`/proc` is normally mounted using the `proc` filesystem, also known as `procfs`.

It is a virtual filesystem provided by the Linux kernel. It exposes the current runtime state of processes, the kernel, and the system.

Common entries include:

```text
/proc/cpuinfo
/proc/meminfo
/proc/uptime
/proc/<PID>/
```

Most entries under `/proc` are not ordinary files stored persistently on disk or in RAM.

The underlying system state is held in {{< term "Kernel memory structures" "Core data structures maintained in RAM by the kernel and dynamically updated to reflect the current state of processes, memory, devices, and the system." >}}. When a `/proc` entry is read, the kernel dynamically generates its content from the current state.

## sysfs and /sys

`/sys` is normally mounted using the `sysfs` filesystem.

It is another virtual filesystem that exposes kernel objects, devices, drivers, and hardware-related information.

Common paths include:

```text
/sys/class
/sys/block
/sys/devices
/sys/module
```

Like `/proc`, most content under `/sys` is provided dynamically by the kernel rather than stored as ordinary disk files.

## Paths and Storage Types

- `/` commonly uses `ext4` or `xfs` and stores persistent data on disk.
- `/tmp` may use a disk-based filesystem or `tmpfs`.
- `/run` commonly uses `tmpfs`.
- `/proc` uses `proc` and exposes dynamically generated runtime information.
- `/sys` uses `sysfs` and exposes kernel objects and device information.
- `/dev/shm` commonly uses `tmpfs` for shared memory.

## Key Points

- A directory path does not identify its filesystem type.
- `tmpfs` stores file contents in virtual memory, backed by RAM and optionally swap.
- `/proc` obtains data from kernel memory but generates file contents when they are read.
- `/tmp` is not necessarily mounted as `tmpfs`.
- Use `findmnt` to determine the filesystem type of a path.
