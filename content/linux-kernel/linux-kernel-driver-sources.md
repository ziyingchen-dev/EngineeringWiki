---
title: "Where to Find Linux Kernel Drivers"
weight: 22
date: 2026-10-04T18:56:00+08:00
draft: false
---

## Start with the Supported Kernel

For a driver intended for a particular product, first identify the board, SoC, and kernel version used by its BSP. The board or SoC vendor's official BSP repository and release documentation are often the best starting point because they contain the versions and patches validated for that platform.

For a driver intended for upstream Linux or a broadly supported device, check the mainline kernel source before looking for a separate download. Many drivers are already maintained in the kernel tree, commonly under `drivers/`, with hardware descriptions and bindings in other parts of the tree.

## Common Sources

| Source | When to use it | What to verify |
|--------|----------------|----------------|
| Mainline Linux kernel | The driver is upstream or you want the latest accepted implementation | Supported kernel versions, device IDs, and required device-tree bindings |
| Board or SoC vendor BSP | The product depends on vendor-specific kernel changes | Repository branch, release tag, patches, and matching BSP documentation |
| Device or component manufacturer | The vendor supplies an out-of-tree driver or firmware | Supported kernels and architectures, maintenance status, license, and integration instructions |
| Yocto or another distribution layer | You need reproducible integration into a product image | Layer compatibility, recipe version, patches, and the kernel provider it targets |

Prefer a maintained upstream driver when it supports the hardware and required features. Vendor forks can be necessary for newer or vendor-specific hardware, but may lag upstream and require ongoing maintenance when updating the kernel.

## Practical Search Flow

1. Record the exact board model and revision, SoC, peripheral part number, and kernel version.
2. Read the board vendor's BSP release notes and source instructions.
3. Search the kernel source for the device name, compatible string, or subsystem. For a local kernel tree:

   ```bash
   git grep -n "vendor,device" -- drivers Documentation
   find drivers -maxdepth 2 -type d | head
   ```

4. If the driver is not in the supported tree, check the SoC or device manufacturer's official source repository and the matching BSP release.
5. Confirm how the driver is enabled: kernel configuration, device tree, module packaging, firmware, and any required patches.

The `compatible` string is commonly used by Device Tree-based systems to match a device description to a driver. Search using the exact string from the board's device tree or binding documentation where possible.

## Important Checks

- **Kernel compatibility:** External modules use kernel interfaces and must be built for the target kernel configuration and ABI. A module built for a different kernel release may fail to load; matching `uname -r` alone does not guarantee compatibility.
- **Architecture and toolchain:** Confirm the target architecture and use the matching cross-compilation toolchain when building off-device.
- **License and provenance:** Check the driver's license, source origin, maintenance status, and any firmware redistribution terms before shipping it.
- **Safety:** Avoid unverified binary drivers and random download sites. Prefer official vendor repositories, the BSP's documented source, or upstream Linux.
- **Integration:** A working driver may also need device-tree nodes, clocks, pin control, regulators, interrupts, firmware, or kernel configuration.

Do not assume that every device has a separate downloadable driver. Many Linux drivers are already included in the kernel, and the remaining board-specific work may be configuration or device-tree integration.

## References

- [Mainline Linux kernel source](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/)
- [Linux kernel source browser](https://elixir.bootlin.com/linux/latest/source)
- [Linux kernel documentation](https://docs.kernel.org/)
- [The Yocto Project documentation](https://docs.yoctoproject.org/)
