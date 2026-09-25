---
title: "Concurrency and Synchronization"
weight: 5
date: 2026-10-04T19:12:00+08:00
draft: false
aliases:
  - "/linux-kernel/concurrency-and-synchronization/"
---

## Identify Shared State and Execution Contexts

Race conditions come from {{< term "concurrency" "The ability of a system to manage multiple tasks that overlap in time. On a single-core CPU, concurrency is achieved by rapidly switching between processes or threads, creating the illusion of simultaneous execution. On multicore systems, concurrency may combine with parallelism, where tasks truly run at the same time on different cores." >}}, not only from {{< term "multicore systems" "Computer systems with multiple CPU cores, allowing different threads or processes to run in parallel on separate cores. This increases performance but also introduces concurrency challenges when multiple cores access shared resources." >}}. Even on one CPU, the kernel switches between process context, {{< term "hard IRQs" "Hardware interrupt requests that trigger immediate execution of a hard IRQ handler (top half). These handlers run in interrupt context, must execute quickly, and cannot sleep or perform heavy processing." >}}, {{< term "softirqs" "Deferred work that runs in softirq context after a hard IRQ handler finishes. Softirqs and tasklets cannot sleep, and the same softirq can run on several CPUs at once." >}}, {{< term "threaded IRQs" "A Linux mechanism where an interrupt handler is split into a fast top half and a deferred bottom half executed in a kernel thread. The threaded handler can sleep and perform complex work safely." >}}, and {{< term "workqueues" "A general deferred work mechanism in Linux. Tasks are queued and executed later in process context by kernel worker threads, allowing operations that may sleep or take longer to complete." >}}. These contexts can {{< term "interleave accesses" "A situation in concurrent or multicore systems where multiple threads or CPUs access the same resource in an overlapping, alternating manner. Instead of one task completing fully before another begins, their operations are interwoven, which can lead to race conditions if not properly synchronized." >}} to the same data.

Before choosing a lock, list:

- the shared data
- every reader and writer
- whether each context may sleep
- the lifetime of each callback

## Common Synchronization Primitives

A mutex or semaphore puts the caller to sleep when the lock is taken. A spinlock busy-waits instead, so it is the only choice in contexts that cannot sleep.

| Primitive | Suitable use | Main limitation |
|-----------|--------------|-----------------|
| `mutex` | Protecting a critical section that may sleep, in process context | Cannot be used in hard IRQ or any other context that cannot sleep |
| {{< term "Semaphore" "A sleeping lock that manages N identical resources. Each context takes one resource and releases it when done, so at most N contexts can use them at the same time. When all N are taken, the next context sleeps until one is released. With N = 1 it behaves like a mutex." >}} | N identical resources, each used by one context at a time (e.g. 3 DMA channels) | May sleep, so process context only. For a single resource, use a mutex |
| `spin_lock()` | Data shared only between process contexts or CPUs, with no IRQ or softirq user | Cannot sleep while held; keep the hold time short. If an IRQ handler also takes this lock, use `spin_lock_irqsave()` in process context |
| `spin_lock_irqsave()` | Data shared between process context and a hard IRQ handler | Turns off local IRQs while held, so the handler cannot interrupt the lock holder; every path must follow the same locking protocol |
| `spin_lock_bh()` | Data shared between process context and softirq / tasklet | Turns off softirq processing on the local CPU; does not mask hard IRQs |
| {{< term "Atomic operations" "Operations that complete as a single indivisible step, so no other CPU or context can observe a half-finished update. They are suited to a single counter or flag, not to updating several related fields together." >}} | Updating a single counter or flag | Do not protect a multi-field structure or provide every required ordering guarantee |
| {{< term "Completion" "A kernel synchronization object that lets one context wait until another context signals that an event has finished. It is commonly used to wait for a callback or a worker to complete during teardown." >}} | Waiting for an event to finish in another context | Manage reuse and wakeup order during teardown |
| {{< term "RCU" "Read-Copy-Update, a mechanism that lets many readers access data without taking a lock while writers publish a new copy. The old copy is freed only after a grace period, when all existing readers have finished." >}} | Read-mostly data that permits lockless readers | Updates and reclamation must follow RCU grace-period rules |

Do not treat atomics, `volatile`, or disabling interrupts as general-purpose locks.

## Data Shared by IRQ and Process Context

Suppose process context and a hard IRQ handler share the same lock, and both use plain `spin_lock()`. On one CPU this can {{< term "deadlock" "A state where a context waits forever for a lock that can never be released. Here, a process holds the lock, is interrupted on the same CPU, and the interrupt handler spins on that same lock, so the process can never run again to release it." >}}:

1. The process takes the lock.
2. An interrupt arrives. The CPU stops the process and runs the IRQ handler.
3. The handler tries to take the same lock and spins, waiting for it.
4. The process cannot run again until the handler returns, so it never releases the lock.

The fix: in process context, turn off local IRQs before taking the lock. The interrupt then cannot arrive while the process holds it.

```c
/* Process context: turn off local IRQs, then take the lock */
spin_lock_irqsave(&d->lock, flags);
d->count++;
spin_unlock_irqrestore(&d->lock, flags);

/* Hard IRQ handler: plain spin_lock() is enough */
spin_lock(&d->lock);
d->count++;
spin_unlock(&d->lock);
```

The handler can use plain `spin_lock()` because {{< term "local IRQs" "Hardware interrupts that occur on the current CPU core. Disabling local IRQs prevents the CPU from being interrupted while executing critical sections, ensuring that interrupt handlers cannot preempt code holding a lock. Local IRQ control only affects the current CPU, while other CPUs may still respond to interrupts. In contrast, global IRQs are managed at the system-wide level: disabling or masking a global IRQ prevents any CPU in a multicore system from responding to that interrupt line, ensuring consistency across the entire system." >}}
 are already off while it runs. If another CPU holds the lock, that CPU will release it soon, so the handler only spins briefly.

A threaded IRQ handler runs in process context, so it uses `spin_lock_irqsave()` when it shares data with the top half.

## Design and Review Checklist

1. State which lock protects each field and identify all access paths.
2. Keep each {{< term "critical section" "The region of code between acquiring and releasing a lock, during which shared data is accessed. Keeping it short reduces contention and the time other contexts spend waiting." >}} to the necessary state update, and do expensive work after releasing the lock.
3. With multiple locks, define a fixed acquisition order. Do not synchronously wait for a callback while holding a lock that the callback may take in the reverse order.
4. Atomicity does not give {{< term "memory ordering" "The order in which one CPU's memory reads and writes become visible to other CPUs. Both the compiler and the CPU may reorder accesses, so kernel acquire/release or barrier APIs are needed when order matters." >}}. When order matters, use acquire/release or barrier APIs.
5. Do not call functions that may sleep while holding a spinlock. This includes synchronous waits and `GFP_KERNEL` allocations; use `GFP_ATOMIC` instead.
6. During teardown, prevent new callbacks, wait for existing callbacks to finish, then free shared data.
7. Enable {{< term "lockdep" "A kernel runtime lock validator that tracks lock acquisition order and context. It reports possible deadlocks, such as inconsistent lock ordering, even if the deadlock has not actually occurred yet." >}} and {{< term "KCSAN" "Kernel Concurrency Sanitizer, a dynamic data-race detector. It reports memory accesses from different contexts to the same location that are not protected by proper synchronization." >}} during development, and test concurrent access and unload paths on {{< term "SMP" "Symmetric Multi-Processing, a system where multiple CPUs share the same memory and run the same kernel. It exposes races that may never appear on a single CPU." >}} systems.

## References

- [Linux kernel locking documentation](https://docs.kernel.org/locking/)
- [Linux kernel memory barriers](https://docs.kernel.org/core-api/wrappers/memory-barriers.html)
- [Lockdep design](https://docs.kernel.org/locking/lockdep-design.html)