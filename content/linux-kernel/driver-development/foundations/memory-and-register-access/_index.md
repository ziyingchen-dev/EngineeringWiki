---
title: "Memory Management and Register Access"
weight: 3
date: 2026-10-04T19:12:00+08:00
draft: false
aliases:
  - "/linux-kernel/memory-and-register-access/"
---

<style>
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

## Overview

A driver touches three kinds of memory. Each has its own API, and they are not interchangeable.

| Kind | What it is | Who issues the access | API family |
|---|---|---|---|
| Ordinary kernel memory | RAM for the driver's own data | CPU | `kmalloc()`, `vmalloc()` |
| Device registers (MMIO) | A device's control registers, mapped into the CPU address space | CPU | `ioremap()`, `readl()` / `writel()` |
| DMA buffer | RAM that the device reads or writes by itself | CPU **and** device | `dma_alloc_coherent()`, `dma_map_*()` |

<details>
<summary><strong>Background: how the CPU, RAM, and devices interact</strong></summary>

```text
        ┌───────────────┐   1. MMIO: CPU accesses device registers   ┌──────────┐
        │               │ ─────────────────────────────────────────> │          │
        │      CPU      │                                            │  Device  │
        │  ┌─────────┐  │ <───────────────────────────────────────── │          │
        │  │   MMU   │  │   4. Interrupt: device signals the CPU     └─────┬────┘
        │  └────┬────┘  │                                                  │
        └───────┼───────┘                                                  │ 3. DMA (DMA address)
                │ 2. CPU accesses RAM                                 ┌────┴─────┐
                │ (physical address)                                  │  IOMMU   │
                │                                                     └────┬─────┘
                │                                                          │ (physical address)
                ▼                                                          ▼
        ┌──────────────────────────────────────────────────────────────────────┐
        │  RAM                                                                 │
        │  OS code, page tables, IOMMU page tables, driver code, data, buffers │
        └──────────────────────────────────────────────────────────────────────┘
```

An arrow points from the component that starts the access to the component being accessed. It does not show the direction of the data.

| # | Initiator → Target | What happens |
|---|---|---|
| 1 | CPU → device | The CPU reads or writes a device register (MMIO) |
| 2 | CPU → RAM | The CPU reads or writes data |
| 3 | Device → RAM | The device reads or writes RAM by itself (DMA) |
| 4 | Device → CPU | The device raises an interrupt to signal an event |

| Component | What it translates | Notes |
|---|---|---|
| MMU | Addresses issued by the CPU: virtual address → physical address | Inside the CPU. Every CPU access goes through it, including MMIO (step 1). The OS builds the page tables in RAM; the MMU only reads them. |
| IOMMU | Addresses issued by devices: DMA address → physical address | Between the device and RAM. Without an IOMMU, a DMA address is usually the physical address itself. |

The IOMMU is not a separate chip. It is a hardware block inside the CPU, SoC, or chipset, usually in the PCIe root complex. The diagram draws it as a box only to show where the translation happens. The interrupt in step 4 reaches the CPU through an interrupt controller, which the diagram omits.

**Example: a network card transmits one packet.**

| Step | Who | What happens |
|---|---|---|
| 1 | CPU (running the driver) | Prepares the packet in RAM (interaction 2) |
| 2 | CPU (running the driver) | Writes the packet's DMA address and length into the card's registers (interaction 1) |
| 3 | CPU (running the driver) | Writes a register to start the transfer (interaction 1) |
| 4 | Card | Reads the packet from RAM by itself (interaction 3), then transmits it onto the network |
| 5 | Card | Raises an interrupt when done (interaction 4) |
| 6 | CPU (running the interrupt handler) | The driver releases the buffer |

The driver is code stored in RAM. Every action attributed to the driver is carried out by the CPU executing that code. The CPU does not copy the data in step 4, so it can do other work.

</details>

### Three kinds of address

When the CPU reads or writes memory, the address changes form along the way:

```text
CPU running driver code        MMU                    RAM or device
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────┐
│ virtual address  │ ─>│ page table lookup│ ─>│ physical address     │
└──────────────────┘   └──────────────────┘   └──────────────────────┘

Device doing DMA               IOMMU (if present)     RAM
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────┐
│ DMA address      │ ─>│ IOMMU lookup     │ ─>│ physical address     │
└──────────────────┘   └──────────────────┘   └──────────────────────┘
```

| Address | Used by | Translated by | Notes |
|---|---|---|---|
| Virtual address | CPU, when running kernel or driver code | MMU, using page tables the OS builds | Every pointer in kernel or driver C code holds a virtual address. |
| Physical address | The CPU after MMU translation, and the memory system | Not translated further | Also called the CPU address space. Points to DRAM or to a device's MMIO region. |
| {{< term "DMA address" "The address a device uses when it reads or writes RAM by itself. It may equal the physical address, or an IOMMU may translate it. The type is dma_addr_t." >}} | The device | IOMMU, if present | Only the DMA API gives you a correct one. |

For example, when a driver writes a value through a pointer, the CPU first sees the virtual address. The MMU translates it to a physical address, and the write reaches RAM (or a device register, if the physical address belongs to a device).

A pointer returned by `kmalloc()` is a virtual address, meaningful only to the CPU. To tell a device where a buffer is, write the `dma_addr_t` from the DMA API into the device's register. Do not write the pointer (the device cannot use virtual addresses), and do not compute the address with `virt_to_phys()` (it ignores the IOMMU).

## Kernel Memory Allocation

Choose the API by what the memory is for.

| API | Memory you get | Use it for |
|---|---|---|
| `kmalloc()` / `kfree()` | Small block, physically contiguous | Small objects and structures |
| `kzalloc()` | Same as `kmalloc()`, zero-filled | Structures where an uninitialized field would be a bug |
| `vmalloc()` / `vfree()` | Large block, virtually contiguous, physically not guaranteed contiguous | Large buffers that only the CPU accesses |
| `devm_kzalloc()` | Same as `kzalloc()`, released automatically | Per-device data allocated in `probe()` |

`devm_*` ("device-managed") APIs tie the memory to the device. The kernel releases it when the driver unbinds from the device, or when `probe()` fails. You do not call `kfree()` yourself.

### Which flag to pass

Allocation may need to wait for the kernel to free memory. Waiting is allowed only where the code can {{< term "sleep" "Give up the CPU and wait. Interrupt handlers and code holding a spinlock must not sleep." >}}.

| Where your code runs | Flag | Why |
|---|---|---|
| `probe()`, `remove()`, other process context | `GFP_KERNEL` | The allocation may sleep |
| Interrupt handler, or while holding a spinlock | `GFP_ATOMIC` | The allocation must not sleep, so it fails more easily |

Prefer allocating in `probe()` and reusing the memory, instead of making `GFP_ATOMIC` allocations in hot paths. Always check for allocation failure.

## MMIO Registers

**In short:** a device's registers sit at physical addresses outside DRAM. Map them to a virtual address, then access them with `readl()` / `writel()`.

```c
void __iomem *base;
u32 status;

/* 1. Map the registers (physical address -> kernel virtual address) */
base = devm_platform_ioremap_resource(pdev, 0);
if (IS_ERR(base))
	return PTR_ERR(base);

/* 2. Access registers through the accessors */
status = readl(base + STATUS_REG);
writel(status, base + CONTROL_REG);
```

`devm_platform_ioremap_resource()` takes the first memory resource of the platform device (from the `reg` property in the Device Tree), maps it with device-memory attributes, and unmaps it automatically when the driver unbinds.

| Don't | Do |
|---|---|
| `*(u32 *)0xE0000000 = 1;` (a physical address used as a pointer; the CPU treats it as a virtual address) | `base = ioremap(...)` or `devm_platform_ioremap_resource()`, then `writel(1, base + REG);` |
| `*base = value;` (a plain pointer access to mapped registers) | `writel(value, base + REG);` |
| `memcpy(base, src, len);` (copies to or from registers) | `memcpy_toio(base, src, len);` / `memcpy_fromio(dst, base, len);` |

`writel()` returning does not guarantee the device has received the value (a {{< term "posted write" "A write that the CPU considers complete once it is sent, before the device has received it. Reading a register back from the same device forces earlier writes to complete." >}}). When the hardware spec requires it, read a register back to force the write to complete.

## DMA

### Why DMA

Suppose a driver must send 1500 bytes to a network card.

| | Without DMA | With DMA |
|---|---|---|
| Who moves the data | The CPU writes the bytes to the card's registers one by one (MMIO) | The card reads the bytes from RAM by itself |
| What the CPU does | Busy copying until the last byte | Tells the card where the data is, then does other work |
| How the CPU learns it is done | It finishes the copy itself | The card raises an interrupt |

### One buffer, two addresses

The driver does not push data into the device byte by byte. It fills a buffer in RAM, tells the device where the buffer is, and starts the device. The device then reads the buffer by itself.

"Where" has two answers, because the CPU and the device each use their own address for the same buffer. There is only one copy of the data in RAM.

| Variable | Address type | Used by |
|---|---|---|
| `buf` | Virtual address | CPU. The driver fills the buffer through it. |
| `dma_addr` (type `dma_addr_t`) | DMA address | The device. The driver writes it into a device register. |

The DMA API gives you both. Never write `buf` into a device register.

### Example

```c
void *buf;
dma_addr_t dma_addr;
int ret;

/* 1. Tell the kernel how many address bits the device can use */
ret = dma_set_mask_and_coherent(dev, DMA_BIT_MASK(32));
if (ret)
	return ret;

/* 2. Allocate a buffer. The API returns BOTH addresses. */
buf = dma_alloc_coherent(dev, 4096, &dma_addr, GFP_KERNEL);
if (!buf)
	return -ENOMEM;

/* 3. CPU fills the buffer through buf */
memcpy(buf, data, len);

/* 4. Tell the device where the buffer is: write dma_addr, not buf */
writel(lower_32_bits(dma_addr), base + DMA_ADDR_REG);
writel(len, base + DMA_LEN_REG);

/* 5. Start the device. It now reads the buffer from RAM by itself. */
writel(1, base + CONTROL_REG);

/* 6. Later, when the device is done (interrupt): release the buffer */
dma_free_coherent(dev, 4096, buf, dma_addr);
```

`DMA_ADDR_REG`, `DMA_LEN_REG`, and `CONTROL_REG` are made-up register names. The device's datasheet defines the real ones. In step 1, the mask is the number of address bits the device can generate: a 32-bit device cannot reach RAM above 4 GB, so the kernel gives it buffers below that.

### Two kinds of DMA buffer

The CPU has a cache, so the CPU and the device may see different data for the same RAM. The kernel offers two ways to handle this:

| | Coherent | Streaming |
|---|---|---|
| Idea | The API allocates memory that CPU and device always see consistently | You hand memory you already have to the device for one transfer |
| API | `dma_alloc_coherent()` | `dma_map_single()`, `dma_map_sg()` |
| Use for | Buffers that live as long as the driver, such as a descriptor ring | One transfer, such as a packet or a disk block |

### Further topics

This page stops at the basics. The kernel documentation covers the rest:

| Topic | Where to read |
|---|---|
| Streaming mapping direction, `dma_sync_*`, failure checks | [DMA API HOWTO](https://docs.kernel.org/core-api/dma-api-howto.html) |
| Scatter-gather (`dma_map_sg()`) | [DMA API](https://docs.kernel.org/core-api/dma-api.html) |

## Lifetime and Safety

| Rule | Reason |
|---|---|
| Stop the device's DMA and interrupts **before** freeing a buffer | A running device can write into freed memory |
| Wait for interrupt handlers and work items to finish before freeing what they use | They may still be using that memory |
| Check lengths and indexes | Prevents out-of-bounds access |

## Implementation Checklist

1. Choose the allocation API by purpose: the driver's own data, or memory the device accesses.
2. Map registers with the resource APIs, and access them only through `readl()` / `writel()`.
3. Use the DMA API for every buffer the device accesses.
4. On `remove()` or on an error path, stop the device first, then free.

## References

- [Linux memory allocation guide](https://docs.kernel.org/core-api/memory-allocation.html)
- [Linux device I/O accessors](https://docs.kernel.org/driver-api/device-io.html)
- [Linux DMA API](https://docs.kernel.org/core-api/dma-api.html)
- [Linux DMA API HOWTO](https://docs.kernel.org/core-api/dma-api-howto.html)