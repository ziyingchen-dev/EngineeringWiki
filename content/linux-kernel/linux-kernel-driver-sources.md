---
title: "Where to Find Linux Kernel Drivers"
weight: 22
date: 2026-10-04T18:56:00+08:00
draft: false
---

## Finding a Driver

First, search for the exact chip model:

```text
"<chip model>" Linux driver
```

This provides an initial clue about whether a Linux driver exists.

Then search the kernel repository used by your platform:

```bash
git grep -i "<chip model>" -- drivers/
```

Linux drivers are generally located under:

```text
drivers/<subsystem>/
```

If the driver is not found in your kernel repository, check the chip manufacturer's repository or the board and SoC vendor's BSP.

`uname -r` shows the running kernel release, but it does not confirm whether the driver is enabled or integrated into your platform.

## Platform Integration

Finding a driver and integrating a chip into a platform are separate tasks.

After finding the driver, check your own platform:

- **Kernel configuration:** Confirm that the driver is enabled.
- **Device Tree:** Describe the chip's bus, address, GPIO, interrupt, and other connections.
- **Schematic:** Confirm that the Device Tree matches the physical connections.
- **Firmware:** Check only when the chip or driver explicitly requires a firmware file.

The basic flow is:

```mermaid
flowchart LR
    A[Search by chip model] --> B["Find the driver under drivers/&lt;subsystem&gt;/"]
    B --> C[Check your platform configuration]
```
