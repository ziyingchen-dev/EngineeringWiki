---
title: "Debugging, Tracing, and Performance"
weight: 8
date: 2026-10-04T19:12:00+08:00
draft: false
aliases:
  - "/linux-kernel/debugging-tracing-and-performance/"
---

## Start with Symptoms and Evidence

Record the kernel version, hardware, reproduction steps, expected result, and actual result. Collect logs and traces with low-overhead methods; excessive `printk()` calls can perturb timing and hurt performance. During development, use `dev_dbg()` and dynamic debug to enable messages selectively.

```bash
dmesg -w
cat /proc/interrupts
cat /sys/kernel/debug/tracing/available_tracers
```

Debugfs and tracing features require kernel configuration and may require debugfs to be mounted. Do not assume they are enabled in a production image.

## Logging and Failure Analysis

- Use device-aware helpers such as `dev_err()`, `dev_warn()`, and `dev_dbg()` with enough context to diagnose failures.
- `WARN_ON()` is useful for an invariant that should not be violated but may allow recovery; it is not a substitute for validating user input.
- Avoid using `BUG_ON()` to crash the kernel on ordinary error paths. Validate input and return an error instead of turning a recoverable condition into a kernel panic.
- For a panic, oops, or lockup, preserve the full console log, kernel configuration, symbols, and matching unstripped `vmlinux` before analyzing the call trace.

## Dynamic Debug, ftrace, and perf

| Tool | Use |
|------|-----|
| Dynamic debug | Selectively enable `dev_dbg()` / `pr_debug()` messages |
| ftrace | Trace functions and kernel events such as scheduling, IRQs, and latency |
| `trace-cmd` | Collect and inspect ftrace traces |
| `perf` | Analyze CPU, hardware-counter, and software-event performance |
| kprobes / eBPF | Dynamically observe selected functions or events, subject to kernel configuration, permissions, and availability |

Before tracing, define a hypothesis and select events, filters, and a short collection window. Unfiltered tracing can generate excessive data or perturb the behavior being measured.

## Memory and Concurrency Diagnostics

- **KASAN:** Detects memory errors such as out-of-bounds access and use-after-free; adds memory and runtime overhead.
- **KMSAN:** Finds uses of uninitialized values where supported by the architecture and build.
- **KCSAN:** Detects data races.
- **kmemleak:** Helps identify allocated memory that is no longer reachable.
- **lockdep:** Checks lock usage and lock ordering.

These tools are generally used in test or debug kernels; availability and supported configurations vary by version and architecture. The absence of a report from one tool does not prove the code is free of defects.

## Performance Tuning Workflow

1. Define a measurable goal, such as IRQ latency, throughput, CPU utilization, or packet loss.
2. Establish a baseline on the target hardware under representative load.
3. Use perf, ftrace, or subsystem statistics to locate the bottleneck.
4. Change one thing at a time, repeat the same test, and check for regressions in functionality, power, and latency.
5. Preserve configuration, traces, and test programs so the result can be reproduced.

## References

- [Linux kernel tracing](https://docs.kernel.org/trace/)
- [ftrace documentation](https://docs.kernel.org/trace/ftrace.html)
- [Linux perf documentation](https://docs.kernel.org/admin-guide/perf-security.html)
- [Kernel debugging guides](https://docs.kernel.org/dev-tools/)
- [Linux dynamic debug](https://docs.kernel.org/admin-guide/dynamic-debug-howto.html)
