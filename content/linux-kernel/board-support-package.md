---
title: "What Is a BSP?"
weight: 21
date: 2026-10-04T18:56:00+08:00
draft: false
---

## Definition

<span class="term-blue">A BSP (Board Support Package) is the board- or platform-specific software and configuration needed to bring an operating system up on a particular hardware design.</span>

A BSP is not necessarily one package or one directory. Its components may be stored in different repositories, packages, or build-system directories.

## Why a BSP Is Needed

An operating system contains general support for processors, memory, and devices.

A BSP provides the board-specific details, such as:

- How the board starts.
- Which hardware devices are present.
- How the devices are connected.
- Which drivers and settings are required.

## Common Components

A Linux BSP commonly includes:

- **Bootloader configuration:** U-Boot environment variables, `defconfig`, boot commands, and board initialization settings.
- **Kernel configuration and patches:** Kernel configuration files or fragments, plus changes to `.c`, `.h`, `Makefile`, and `Kconfig` files.
- **Device trees:** `.dts` and `.dtsi` source files, which are compiled into `.dtb` files.
- **Hardware drivers:** Usually `.c` and `.h` files, together with related `Makefile` and `Kconfig` entries.
- **Firmware:** Binary code loaded into hardware components or processors, such as network controllers, GPUs, or management controllers.
- **Board-specific build settings:** Settings that select the CPU architecture, kernel, bootloader, device tree, image format, and other build options.

These components may be stored in different repositories, packages, or build-system directories, but together they provide support for the target board.

## Key Points

- A BSP supports a specific board or hardware platform.
- A BSP is a collection of related components.
- It is not necessarily a single package or directory.
- Its structure depends on the vendor, operating system, and build system.