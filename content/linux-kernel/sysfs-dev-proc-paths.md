---
title: "Understanding Linux System Paths"
weight: 20
date: 2026-10-17T00:00:00+08:00
draft: false
---

Linux exposes different types of system information through different filesystem paths.

Choose a path based on what you need:

- `/dev`: access a device
- `/sys`: inspect or configure devices known to the kernel
- `/proc`: inspect live process and system state
- `/lib/modules`: find installed kernel modules
- `/sys/kernel/debug`: inspect kernel debugging information
- `/run`: inspect temporary userspace runtime state

These paths are not different names for the same interface. Each path presents a different view of the system.

---

## `/dev`: Device Access

`/dev` contains device nodes that userspace programs can open. Programs interact with these nodes through operations such as `open()`, `read()`, `write()`, and `ioctl()`.

Use `/dev` when a program needs to exchange data with a device through a file-like interface.

**Examples:**

- `/dev/ttyS0`: A program can open this node to send and receive data through the first serial port.
- `/dev/sda`: Disk utilities can access this node to read or manage an entire storage device.
- `/dev/i2c-1`: An I2C userspace tool can open this node to communicate with devices connected to I2C bus 1.

Common entries include character devices, block devices, virtual devices, and bus access nodes.

The main purpose of `/dev` is device access. It does not describe how the kernel organizes the device.

---

## `/sys`: Device Information

`/sys` presents devices, drivers, buses, classes, and attributes from the Linux kernel device model. Userspace can read attributes to inspect device state and, for writable attributes, change accepted settings.

Use `/sys` when checking what the kernel knows about a device, which driver controls it, or which attributes it exposes.

**Examples:**

- `/sys/class/net`: Check this directory to find network interfaces and inspect properties such as link state and device relationships.
- `/sys/bus/i2c/devices`: Check this directory to see which I2C devices the kernel has registered and which drivers are bound to them.
- `/sys/class/leds`: Check this directory to find registered LED devices and inspect or change attributes such as brightness.

Common information includes device names, driver bindings, bus relationships, hardware attributes, power state, and configuration values.

The main purpose of `/sys` is to describe and configure devices. It is not intended for general device data transfer.

---

## `/proc`: Runtime System State

`/proc` presents the current runtime state of processes, the kernel, and the system. Most entries are generated dynamically from kernel data structures in RAM when accessed, rather than stored persistently as regular files in RAM or on disk.

Use `/proc` when checking live process information, system statistics, or kernel runtime settings.

**Examples:**

- `/proc/meminfo`: Read this file to check current memory usage, available memory, and kernel memory statistics.
- `/proc/1`: Check this directory to inspect the state, resources, and runtime information of process ID 1.
- `/proc/cpuinfo`: Read this file to inspect processor information reported by the kernel.

Common information includes process state, memory usage, CPU information, kernel parameters, and system statistics.

The main purpose of `/proc` is to show the current runtime state of the system, not to represent physical devices.

---

## `/lib/modules`: Installed Kernel Modules

`/lib/modules` stores kernel module files and related metadata for each installed kernel version. Module management tools such as `modprobe` and `depmod` use this information to locate modules and resolve dependencies.

Use `/lib/modules` when locating a module file or checking module metadata for a specific kernel version.

**Examples:**

- `/lib/modules/$(uname -r)/kernel/`: Search this directory when locating module files built for the running kernel.
- `/lib/modules/$(uname -r)/modules.dep`: Inspect this file when checking dependencies between installed modules.

Common content includes module files, dependency records, aliases, symbols, and other generated metadata.

The main purpose of `/lib/modules` is to store installed module files. It does not present live module or device state.

---

## `/sys/kernel/debug`: Kernel Debugging

`/sys/kernel/debug/` is the usual mount point for `debugfs`, which exposes debugging interfaces provided by the kernel and individual drivers.

Use this path when tracing kernel activity or investigating low-level driver behavior during development.

**Examples:**

- `/sys/kernel/debug/tracing`: Use these interfaces to record and inspect kernel events while investigating runtime behavior.
- `/sys/kernel/debug/gpio`: Read this entry to inspect registered GPIO controllers, assigned pins, and their current state when the interface is available.

Common information includes tracing data, driver-specific state, internal kernel details, and development-only controls.

These interfaces may require elevated permissions, and some entries appear only when the corresponding kernel feature or driver is enabled. Their layout can change between kernel versions, so they should not be treated as stable application interfaces.

---

## `/run`: Temporary Userspace State

`/run` stores temporary userspace state created during the current boot. System services and daemons place sockets, PID files, locks, and other coordination data here.

Use `/run` when checking the current state of a service or locating temporary files created after boot.

**Examples:**

- `/run/systemd`: Check this directory when investigating temporary runtime state maintained by systemd.
- `/run/lock`: Check this directory when determining whether a service or process has created a runtime lock.

The contents of `/run` normally disappear after reboot.

Unlike `/proc`, which exposes kernel and process state, `/run` mainly contains state created and managed by userspace services.