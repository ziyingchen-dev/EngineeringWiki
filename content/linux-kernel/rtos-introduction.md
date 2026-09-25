---
title: "What Is an RTOS?"
weight: 20
date: 2026-10-04T18:56:00+08:00
draft: false
---

## Definition

An RTOS (real-time operating system) is an operating system designed to provide predictable responses to events. Its key property is not simply being fast: <span class="term-blue">it is being able to meet timing requirements with bounded, understood latency.</span>

For example, a motor-control task may need to read sensors and update outputs before a deadline every few milliseconds. Missing that deadline may make the system incorrect even if the average execution time is low.

## Real-Time Categories

| Category | Meaning | Example consequence of a missed deadline |
|----------|---------|------------------------------------------|
| Hard real time | Every deadline must be met for the system to be correct | A missed control deadline can be a system failure |
| Firm real time | A result after its deadline is useless, but occasional misses may be tolerated | A late measurement is discarded |
| Soft real time | A late result is less useful, but still has value | Audio or video may briefly stutter |

These categories describe application requirements, not a simple ranking of operating systems.

## RTOS and General-Purpose OS

An RTOS is designed to respond within predictable time limits. <span class="term-blue">It commonly includes task priorities, interrupt handling, timers, and tools for coordinating tasks.</span>

Linux supports many types of applications and shares CPU time among running programs while maintaining overall system performance. With `PREEMPT_RT`, Linux can reduce scheduling delays and provide more predictable response times. However, it must still be tested on the actual hardware to confirm that it meets the required deadlines.

| Consideration | RTOS | Linux |
|---|---|---|
| Timing | Designed for predictable response times | Requires configuration and testing for real-time workloads |
| Resources | Often runs on devices with limited memory and storage | Usually requires more memory and storage |
| Features | Provides a focused set of system services | Provides extensive filesystem, networking, process, and application support |
| Common use | Control systems, sensors, and microcontrollers | Gateways, single-board computers, and complex embedded products |

## Examples

- FreeRTOS and Zephyr are commonly used on microcontrollers.
- QNX is commonly used in systems requiring high reliability.
- Linux is widely used in embedded systems, with `PREEMPT_RT` available for workloads requiring more predictable timing.

The choice depends on timing requirements, hardware resources, reliability requirements, driver support, and available software.

## References

- [Linux kernel documentation: Real-time preemption](https://docs.kernel.org/core-api/real-time/index.html)
- [The Linux kernel documentation](https://docs.kernel.org/)
