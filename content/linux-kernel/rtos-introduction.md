---
title: "What Is an RTOS?"
weight: 20
date: 2026-10-04T18:56:00+08:00
draft: false
---

## Definition

An RTOS (real-time operating system) is an operating system designed to provide predictable responses to events. Its key property is not simply being fast: it is being able to meet timing requirements with bounded, understood latency.

For example, a motor-control task may need to read sensors and update outputs before a deadline every few milliseconds. Missing that deadline may make the system incorrect even if the average execution time is low.

## Real-Time Categories

| Category | Meaning | Example consequence of a missed deadline |
|----------|---------|------------------------------------------|
| Hard real time | Every deadline must be met for the system to be correct | A missed control deadline can be a system failure |
| Firm real time | A result after its deadline is useless, but occasional misses may be tolerated | A late measurement is discarded |
| Soft real time | A late result is less useful, but still has value | Audio or video may briefly stutter |

These categories describe application requirements, not a simple ranking of operating systems.

## RTOS and General-Purpose OS

An RTOS typically provides priority-based scheduling, interrupt handling, timers, and synchronization primitives intended for predictable response. Many RTOSes run with a small memory footprint and may have a simpler application model, but those are common design choices rather than the definition of real time.

General-purpose Linux prioritizes broad functionality, throughput, and fairness. With the `PREEMPT_RT` real-time preemption support, Linux can provide substantially more predictable scheduling and interrupt latency. Whether it meets a particular hard-real-time requirement must still be demonstrated on the target hardware and workload; the label “real time” alone is not a guarantee.

| Consideration | Typical RTOS deployment | Typical Linux deployment |
|---------------|-------------------------|--------------------------|
| Timing | Small, bounded response is often central to the design | General-purpose behavior unless configured and validated for real-time needs |
| Resources | Often suitable for constrained microcontrollers | Usually needs more memory and storage |
| Services | Commonly a focused set of OS services | Rich process, filesystem, networking, and userspace ecosystem |
| Common use | Control loops, sensors, small embedded devices | Gateways, single-board computers, and feature-rich embedded products |

## Examples

- FreeRTOS and Zephyr are commonly used in microcontroller and embedded systems.
- QNX is used in several safety- and reliability-focused embedded domains.
- Linux is widely used in embedded products; `PREEMPT_RT` is relevant when tighter scheduling latency is required.

The right choice depends on deadlines, worst-case latency, hardware resources, safety requirements, available drivers, and the software ecosystem.

## References

- [Linux kernel documentation: Real-time preemption](https://docs.kernel.org/core-api/real-time/index.html)
- [The Linux kernel documentation](https://docs.kernel.org/)
