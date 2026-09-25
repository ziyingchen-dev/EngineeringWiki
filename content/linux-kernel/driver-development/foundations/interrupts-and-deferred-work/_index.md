---
title: "Interrupts and Deferred Work"
weight: 4
date: 2026-10-04T19:12:00+08:00
draft: false
aliases:
  - "/linux-kernel/interrupts-and-deferred-work/"
---

<style>
.term-blue {
  font-weight: 600;
  text-decoration: underline 3px #005A9C;
  text-underline-offset: 4px;
}
.reference-box mark {
     background:#FFF9C4;
     color:#17202A;
     padding:0 .25em;
     border-radius:3px
}
details {
  border: none;
  padding: 0;
  margin: 1em 0;
}
details > summary {
  display: inline;
  cursor: pointer;
  list-style: none;
  color: var(--term-color, #2f81c7);
  border-bottom: 1px dotted currentColor;
}
details > summary::-webkit-details-marker { display: none; }
details > summary strong {
  font-weight: inherit;
}
details[open] > summary {
  display: inline-block;
  margin-bottom: 0.5em;
}
details[open] {
  border-left: 2px solid var(--term-color, #2f81c7);
  padding-left: 1em;
}
</style>

## Splitting Interrupt Work

A Linux interrupt handler is split into two parts. The top half must return quickly, so everything slow is deferred to the bottom half.

| | Top half (hard IRQ handler) | Bottom half (deferred work) |
|---|---|---|
| Context | Interrupt context | Depends on mechanism |
| Can sleep | No | Depends on mechanism |
| Job | Identify the source, save essential state, {{< term "acknowledge or mask the interrupt" "Acknowledging an interrupt means signaling to the device or interrupt controller that the request has been received and handled, allowing the device to clear its request. Masking an interrupt means disabling or blocking the interrupt line so the CPU will not respond to it until the mask is removed, typically to protect critical code sections from being interrupted." >}} | Slow or complex work: long processing, sleeping, taking a {{< term "mutex" "A synchronization primitive that enforces mutual exclusion, allowing only one thread or process to access a shared resource at a time. Other threads must wait until the mutex is released before proceeding." >}} |

### Bottom-half mechanisms

| Mechanism | Context | Can sleep | Notes |
|---|---|---|---|
| Threaded IRQ | Dedicated kernel thread (process) | Yes | Keeps IRQ semantics; for handlers that need sleepable APIs |
| Workqueue | Process | Yes | Non-urgent work |
| Softirq / NAPI | Softirq (interrupt) | No | High-throughput paths such as networking; follow subsystem rules |
| Tasklet | Softirq (interrupt) | No | Legacy; new drivers should prefer the others |

A bottom half that cannot sleep must not take a mutex.

## Requesting an IRQ

Get the IRQ number from the bus framework (e.g. `platform_get_irq()`). Never hard-code it.

The example below uses a **threaded IRQ**:

```c
/* Top half: interrupt context, cannot sleep */
static irqreturn_t example_irq(int irq, void *data)
{
	struct example_dev *d = data;
	u32 status = readl(d->base + STATUS_REG);

	if (!(status & MY_IRQ_BIT))
		return IRQ_NONE;                    /* not from this device */

	writel(status, d->base + STATUS_REG);   /* clear essential status */
	return IRQ_WAKE_THREAD;                 /* defer the rest to the thread */
}

/* Bottom half: process context, may sleep */
static irqreturn_t example_irq_thread(int irq, void *data)
{
	/* complex or sleepable work here */
	return IRQ_HANDLED;
}

static int example_probe(struct platform_device *pdev)
{
	...
	d->irq = platform_get_irq(pdev, 0);
	if (d->irq < 0)
		return d->irq;

	ret = devm_request_threaded_irq(&pdev->dev, d->irq,
					example_irq, example_irq_thread,
					IRQF_ONESHOT | IRQF_SHARED,
					dev_name(&pdev->dev), d);
	if (ret)
		return dev_err_probe(&pdev->dev, ret, "failed to request IRQ\n");
	...
}
```

| Return value | Meaning |
|---|---|
| `IRQ_NONE` | Not this device's interrupt (required on shared lines) |
| `IRQ_WAKE_THREAD` | Urgent part done; run the threaded handler next |
| `IRQ_HANDLED` | Fully handled |

| Flag | Meaning |
|---|---|
| `IRQF_ONESHOT` | Keep the IRQ masked until the threaded handler finishes |
| `IRQF_SHARED` | Allow other devices on the same line; the handler must be able to return `IRQ_NONE` |

<details>
<summary><strong>Workqueue example</strong></summary>

Same structure, but the top half queues a work item instead of waking a thread. Only the differences are shown.

```c
struct example_dev {
	void __iomem *base;
	int irq;
	struct work_struct work;
};

/* Bottom half: process context, may sleep */
static void example_work_fn(struct work_struct *work)
{
	struct example_dev *d = container_of(work, struct example_dev, work);

	/* complex or sleepable work here */
}

/* Top half: interrupt context, cannot sleep */
static irqreturn_t example_irq(int irq, void *data)
{
	struct example_dev *d = data;
	u32 status = readl(d->base + STATUS_REG);

	if (!(status & MY_IRQ_BIT))
		return IRQ_NONE;                    /* not from this device */

	writel(status, d->base + STATUS_REG);   /* clear essential status */
	schedule_work(&d->work);                /* defer the rest to the workqueue */
	return IRQ_HANDLED;                     /* not IRQ_WAKE_THREAD */
}

static int example_probe(struct platform_device *pdev)
{
	struct example_dev *d;
	int ret;

	d = devm_kzalloc(&pdev->dev, sizeof(*d), GFP_KERNEL);
	if (!d)
		return -ENOMEM;

	d->base = devm_platform_ioremap_resource(pdev, 0);
	if (IS_ERR(d->base))
		return PTR_ERR(d->base);

	d->irq = platform_get_irq(pdev, 0);
	if (d->irq < 0)
		return d->irq;

	platform_set_drvdata(pdev, d);          /* used by example_remove() */
	INIT_WORK(&d->work, example_work_fn);   /* before requesting the IRQ */

	ret = devm_request_irq(&pdev->dev, d->irq, example_irq,
			       IRQF_SHARED, dev_name(&pdev->dev), d);
	if (ret)
		return dev_err_probe(&pdev->dev, ret, "failed to request IRQ\n");

	/* Enable the device interrupt only after the handler is registered */
	writel(MY_IRQ_BIT, d->base + IRQ_ENABLE_REG);

	return 0;
}
```

- No `IRQF_ONESHOT` is needed, because there is no threaded handler.
- Call `INIT_WORK()` first; otherwise the IRQ may fire before the work is initialized.
- For a dedicated queue or ordering control, use `alloc_workqueue()` + `queue_work()`.

</details>

## Removal and Error Paths

Bottom halves may run on another CPU, or after removal has started. During removal:

1. Stop the hardware from generating interrupts and stop DMA.
2. Cancel or flush pending work.
3. Make sure no handler touches data that will be freed.

`devm` releases the IRQ registration automatically, but does not stop queued work. For the workqueue example:

```c
static void example_remove(struct platform_device *pdev)
{
	struct example_dev *d = platform_get_drvdata(pdev);

	disable_irq(d->irq);          /* no new work can be queued */
	cancel_work_sync(&d->work);   /* wait for running work, drop pending work */
}
```

## Debugging

```bash
cat /proc/interrupts
cat /sys/kernel/debug/irq/irqs/<irq>
dmesg -w
```

IRQ debugfs entries depend on kernel configuration. To investigate latency, use ftrace IRQ-handler events under representative load on the target hardware.

## References

- [Linux generic IRQ handling](https://docs.kernel.org/core-api/genericirq.html)
- [Linux workqueue documentation](https://docs.kernel.org/core-api/workqueue.html)
- [Linux kernel driver basics](https://docs.kernel.org/driver-api/basics.html)