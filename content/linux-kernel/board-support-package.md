---
title: "What Is a BSP?"
weight: 21
date: 2026-10-04T18:56:00+08:00
draft: false
---

## Definition

A BSP (Board Support Package) is the board- or platform-specific software and configuration needed to bring an operating system up on a particular hardware design. It connects generic OS code to the details of a board, such as its SoC, memory map, clocks, peripherals, and boot process.

A BSP is not itself an operating system, and the exact contents vary by vendor and product.

## Common Contents

A Linux BSP may include:

- Bootloader sources and board configuration, often based on U-Boot.
- A Linux kernel version, vendor patches, board configuration, and device trees.
- Platform drivers or configuration needed for board peripherals.
- Firmware blobs required by some devices, subject to their separate licensing terms.
- A cross-compilation toolchain, root filesystem, and image-building scripts or metadata.
- Flashing, boot, and recovery instructions.

Some vendors distribute these parts in separate repositories or packages rather than one bundle. A Yocto BSP layer, for example, commonly supplies machine configuration, recipes, patches, and image settings that integrate with the wider Yocto Project build.

## BSP, Kernel, and Driver

| Term | Role |
|------|------|
| Linux kernel | The operating-system kernel shared across many platforms |
| Driver | Kernel code that manages a device or hardware function |
| Device tree | Data describing hardware so the kernel can identify and configure it |
| BSP | The board-specific combination of software, patches, configuration, and build material |

A BSP may contain drivers, but a driver by itself is not a complete BSP. Correct support can also depend on device-tree descriptions, clocks, pin control, firmware, kernel configuration, and integration with the boot and build systems.

## Where to Look

For a specific board, start with the board manufacturer's support page and documentation. Then identify the SoC vendor and the exact BSP release or kernel branch supported for that board. A board vendor may maintain a fork of the kernel with patches that have not yet been accepted upstream.

Check the board revision, SoC variant, kernel version, and release notes before combining components from different BSP releases. Mixing a vendor kernel with unrelated device trees, modules, or firmware can cause build failures or runtime faults.

## References

- [The Yocto Project documentation](https://docs.yoctoproject.org/)
- [Linux kernel documentation: Devicetree](https://docs.kernel.org/devicetree/)
