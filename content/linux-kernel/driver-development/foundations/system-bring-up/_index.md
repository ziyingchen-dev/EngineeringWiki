---
title: "System Bring-Up and Bootloader Integration"
weight: 7
date: 2026-10-04T19:12:00+08:00
draft: false
aliases:
  - "/linux-kernel/system-bring-up/"
---

## Boot Chain

A common embedded Linux boot flow is Boot ROM → bootloader (for example, U-Boot) → Linux kernel → init / userspace. Platforms may have multiple bootloader stages, secure boot, or firmware-loading steps; the actual sequence depends on the SoC and product design.

The bootloader typically loads the kernel image, Device Tree Blob (DTB), and possibly an initramfs, then passes boot arguments. ARM64 systems commonly use loading commands such as `booti`, depending on bootloader configuration and image format; x86/EFI platforms use a different flow.

## Device Tree and Boot Arguments

The DTB describes the board devices and resources the kernel should instantiate at boot. Verify that the bootloader passes a DTB for the actual board and hardware revision, and inspect the kernel command line:

```bash
cat /proc/cmdline
```

Kernel boot arguments such as `earlycon` and `console=` configure early or regular consoles. Whether `earlycon` works depends on the platform's early console driver and configuration; do not assume older `earlyprintk` instructions apply to modern platforms.

## Bring-Up in Stages

When the system does not boot or a device is missing, narrow the problem down by stage:

1. **Bootloader:** Check image load addresses, DTB, initramfs, and boot arguments.
2. **Early console:** Check the UART, console address, and baud rate to obtain the earliest messages.
3. **Kernel decompression and initialization:** Distinguish no console output, a panic, a hang, and a watchdog reset.
4. **Driver probe:** Check device matching, missing resources, suppliers that are not ready, and deferred probing.
5. **Userspace:** Check the root filesystem, init program, modules, firmware, and device nodes.

After the kernel has booted, useful commands include:

```bash
dmesg -T
cat /proc/iomem
cat /proc/interrupts
```

The timestamp conversion in `dmesg -T` is not suitable for every precise timing investigation. If logs show delayed driver probing, inspect deferred-probe information in debugfs (when enabled) and investigate missing clocks, regulators, GPIOs, or parent drivers.

## Configuration and Image Consistency

The bootloader, kernel, DTB, modules, and firmware should come from compatible BSP releases. Before updating any component, check ABI compatibility, Device Tree bindings, and signing requirements. Keep a recovery path, especially for remote or console-less devices.

## References

- [Linux boot parameters](https://docs.kernel.org/admin-guide/kernel-parameters.html)
- [Linux serial console](https://docs.kernel.org/admin-guide/serial-console.html)
- [Linux Devicetree usage model](https://docs.kernel.org/devicetree/usage-model.html)
