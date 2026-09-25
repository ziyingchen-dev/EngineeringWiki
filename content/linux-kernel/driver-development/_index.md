---
title: "Linux Kernel Driver Development"
weight: 1
date: 2026-10-04T19:46:00+08:00
draft: false
---

Driver development is a broad subject. This learning path starts with shared foundations; subsystem-specific and platform-specific material can grow into separate sections as the notes expand.

## Learning Path

- [Foundations](./foundations/): the core concepts used across many driver types.

Begin with driver lifecycle and device interfaces, then learn how hardware is described and resources are accessed. Interrupt handling and concurrency build on those concepts. Subsystem and platform topics are best studied when a target device or project calls for them.

Use QEMU when its emulated machine provides the hardware needed for an exercise, or use a development board with documented kernel support. Validate examples against the target kernel and board rather than assuming a driver or register layout is portable.

## Growing This Section

The foundations are not intended to contain every driver topic. As material grows, add focused sections for areas such as bus-driver development, subsystem-specific drivers, power management, platform bring-up, testing, or performance analysis. Each topic is a page bundle, so detailed guides and examples can be added beneath it without flattening the navigation.
