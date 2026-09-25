---
title: "Concurrency and Synchronization"
weight: 5
date: 2026-10-04T19:12:00+08:00
draft: false
aliases:
  - "/linux-kernel/concurrency-and-synchronization/"
---

## Identify Shared State and Execution Contexts

Race conditions do not only occur on multicore systems: process context, hard IRQs, threaded IRQs, and workqueues can interleave accesses even on one CPU. Before choosing a lock, list the shared data, every reader and writer, whether each context may sleep, and the lifetime of each callback.

## Common Synchronization Primitives

| Primitive | Suitable use | Main limitation |
|-----------|--------------|-----------------|
| `mutex` | Protecting a sleepable critical section in process context | Cannot be used in hard IRQ or another non-sleepable context |
| `spinlock_t` | Short, non-sleepable critical sections | Cannot sleep while held; keep the lock hold time short |
| `spin_lock_irqsave()` | Data shared between process context and a local interrupt handler | Saves and restores local IRQ state; all relevant paths must follow the same locking protocol |
| Atomic operations | Atomic updates to a single counter or flag | Do not protect a multi-field data structure or automatically provide every required ordering guarantee |
| Completion | Waiting for an event to finish in another execution context | Manage reuse and wakeup order during teardown |
| RCU | Read-mostly data that permits lockless readers | Updates and reclamation must follow RCU grace-period rules |

A semaphore is useful for counting resources or specific synchronization patterns; for mutual exclusion, a mutex is usually the right choice. Do not treat atomics, `volatile`, or disabling interrupts as general-purpose locks.

## Data Shared by IRQ and Process Context

If a hard IRQ and process context access the same data, using only `spin_lock()` can deadlock on one CPU: the process holds the lock, is interrupted, and the IRQ handler then waits for that same lock. A common approach is to use `spin_lock_irqsave()` in the process path and the same lock in the IRQ path, but the exact locking pattern must be reviewed against the execution contexts, PREEMPT_RT, and the driver API semantics.

Keep critical sections limited to necessary state updates and do expensive work after releasing the lock. If multiple locks are needed, define a fixed acquisition order. Avoid synchronously waiting for a callback while holding a lock that the callback may acquire in the reverse order.

## Design and Review Checklist

1. State which lock protects each field and identify all access paths.
2. Distinguish atomicity from memory ordering; use kernel acquire/release or barrier APIs when needed.
3. Do not call potentially sleeping functions while holding a spinlock, including paths that may wait synchronously or allocate with `GFP_KERNEL`.
4. During teardown, prevent new callbacks, wait for existing callbacks to finish, and only then free shared data.
5. Enable lockdep and KCSAN during development where possible, and test concurrent access and unload paths on SMP systems.

## References

- [Linux kernel locking documentation](https://docs.kernel.org/locking/)
- [Linux kernel memory barriers](https://docs.kernel.org/core-api/wrappers/memory-barriers.html)
- [Lockdep design](https://docs.kernel.org/locking/lockdep-design.html)
