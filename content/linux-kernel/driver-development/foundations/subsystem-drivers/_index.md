---
title: "Subsystem-Specific Drivers"
weight: 6
date: 2026-10-04T19:12:00+08:00
draft: false
aliases:
  - "/linux-kernel/subsystem-drivers/"
---

## Why Use a Subsystem?

Linux subsystems define common device models, data flows, and userspace ABIs. Device-specific implementations should integrate with the appropriate subsystem instead of creating a private `/dev` protocol. This lets existing tools and applications work across device vendors and enables shared power-management, queueing, and error-handling mechanisms.

## Common Areas

| Area | Common framework or concepts | Typical use |
|------|------------------------------|-------------|
| Networking | `net_device`, NAPI, `sk_buff` | Ethernet, wireless, and other network interfaces |
| NC-SI | NC-SI core / network-controller integration | BMC sideband management of a shared network controller; depends on platform and kernel support |
| Block | Block layer, request queue, blk-mq | Storage devices and block I/O |
| V4L2 | Media controller, video device, buffer queue | Cameras, capture cards, and media pipelines |
| ALSA | PCM, controls, audio codec / SoC audio frameworks | Audio playback, capture, and controls |
| DRM / KMS | GEM / framebuffer, display pipeline, atomic modesetting | Display controllers, GPUs, and display outputs |
| IIO | Channels, triggers, buffers | Sensors, ADCs, DACs, and other industrial I/O |
| HWMON | Sensor attributes, alarms | Temperature, voltage, and fan monitoring, common in servers and BMCs |

APIs evolve across kernel versions and subsystems; follow the documentation, example drivers, and maintainer conventions for the target version. Storage devices should generally use the block or relevant storage framework rather than being exposed as arbitrary character devices.

## Choosing a Framework

1. Search `drivers/` and `Documentation/` for the device's primary function.
2. Find a similar upstream driver and examine its subsystem, binding, Kconfig, and Makefile.
3. Check whether a standard userspace ABI and existing tools are available.
4. Implement the framework's callbacks and lifecycle instead of guessing an interface from the register list.
5. Understand how the subsystem manages DMA, IRQs, buffers, hotplug, and runtime power management.

## Example: Network Driver

A network driver typically registers a device with the networking core through `net_device`, uses NAPI to coordinate interrupt and polling-based packet processing, and represents packets with `sk_buff`. High-throughput paths require careful handling of DMA rings, queue stop/wake behavior, checksum and other offloads, device removal, and error recovery; processing every packet entirely in the IRQ handler is not appropriate.

Other subsystems have distinct buffer, clock, power, and synchronization semantics. Study each framework's documentation and examples rather than applying one subsystem's design directly to another.

## References

- [Linux driver API documentation](https://docs.kernel.org/driver-api/)
- [Linux networking documentation](https://docs.kernel.org/networking/)
- [Linux media documentation](https://docs.kernel.org/userspace-api/media/)
- [Linux IIO documentation](https://docs.kernel.org/driver-api/iio/)
- [Linux hardware monitoring documentation](https://docs.kernel.org/hwmon/)
