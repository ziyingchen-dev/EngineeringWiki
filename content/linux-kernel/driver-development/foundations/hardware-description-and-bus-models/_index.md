---
title: "Hardware Description and Bus Models"
weight: 2
date: 2026-10-04T19:12:00+08:00
draft: false
aliases:
  - "/linux-kernel/hardware-description-and-bus-models/"
---

<style>
.term-blue {
  font-weight: 600;
  text-decoration: underline 3px #005A9C;
  text-underline-offset: 4px;
}
</style>

## Overview

A driver needs two things from the kernel before it can control hardware:

| Question | Answer | Section |
|---|---|---|
| How does the kernel learn that a device exists, and where it is? | **Hardware description**: bus scanning, Device Tree, or ACPI | [Hardware Description](#hardware-description) |
| How does the kernel connect that device to a driver? | **Bus model**: a bus, a driver structure, and a matching flow | [Bus Models](#bus-models) |

## Hardware Description

### Discoverable and non-discoverable devices

| Kind | Examples | How the kernel finds it | Needs a Device Tree entry? |
|---|---|---|---|
| Discoverable | PCI / PCIe and USB devices | The bus enumerates devices and reads their IDs or descriptors | Normally no |
| Non-discoverable | SoC-integrated UART, I2C, SPI controllers; sensors soldered onto an I2C bus | Cannot be found by scanning. The kernel needs a firmware description. | Yes |

A discoverable device still needs a driver (`pci_driver` or `usb_driver`). Discovery only tells the kernel the device exists.

### Device Tree

Device Tree is a hardware list given to the kernel. Each device entry describes its resources: `compatible` string, register address, interrupts, clocks, GPIOs, and regulators. (ACPI plays the same role on many x86 and Arm server platforms.)

File roles:
- `.dts`: describes one board
- `.dtsi`: holds shared content, included by `.dts`
- DTB: compiled output of `.dts`, passed to the kernel by the bootloader

Example, a sensor on an I2C bus. The controller is inside the SoC; the sensor is a chip on the bus:

```dts
&i2c1 {                          /* SoC-integrated I2C controller */
	sensor@48 {                  /* chip on the I2C bus */
		compatible = "vendor,sensor";
		reg = <0x48>;
		interrupt-parent = <&gpio0>;
		interrupts = <12 IRQ_TYPE_LEVEL_LOW>;
	};
};
```

| Line | Meaning |
|---|---|
| `compatible` | Identifies the device model so the kernel can find a matching driver |
| `reg = <0x48>` | The sensor's I2C address (matches `@48`) |
| `interrupt-parent = <&gpio0>` | The interrupt comes from the `gpio0` controller |
| `interrupts = <12 IRQ_TYPE_LEVEL_LOW>` | GPIO pin 12, triggered when the line is low |

The driver lists the `compatible` strings it supports in its `of_match_table`. When a node's `compatible` matches one of them, the driver core calls the driver's `probe()`.

### Rules

| Rule | ❌ Don't | ✅ Do |
|---|---|---|
| Follow the {{< term "binding" "The document that defines which properties a Device Tree node can use, including each property's name, value format, and meaning. Stored in Documentation/devicetree/bindings/." >}} | `irq-pin = <12>;` | {{< term "interrupts" "A standard Device Tree property that tells the kernel which interrupt line the device uses and how it is triggered." >}}: `interrupts = <12 IRQ_TYPE_LEVEL_LOW>;` |
| No hard-coded board values in the driver | Driver: `#define SENSOR_ADDR 0x48` | DT: {{< term "reg" "A standard Device Tree property that gives the device's address, such as an I2C address or a register base address." >}} `reg = <0x48>;`, and the driver reads it |
| No property without a binding | `my-delay = <100>;` | Add `vendor,startup-delay-ms` to the binding first |
| Validate binding changes (only when you add or change a binding) | Edit the binding and skip checks | Write the binding as a {{< term "YAML schema" "A hand-written YAML file that defines which properties a Device Tree node must or may have. Tools check .dts files against it." >}}, then run {{< term "dt_binding_check" "Checks that the binding YAML file itself is correct. Catches syntax errors and misspelled field names." >}} and {{< term "dtbs_check" "Checks that your .dts files match the binding YAML. Catches a missing reg, or a property the binding does not define, such as irq-pin." >}} |

## Bus Models

### Three things to keep apart

Three different things appear in every Linux driver. They are easy to confuse.

| Kind | What it is | Who writes it | Your driver's relationship to it |
|---|---|---|---|
| **Kernel framework code** ({{< term "bus core" "The kernel code that manages one type of bus (I2C core, PCI core, USB core, platform core). It finds devices and matches them to drivers." >}}, {{< term "driver core" "The kernel code that, after a device matches a driver, calls that driver's probe()." >}}) | Code inside the kernel that finds devices, matches them to drivers, and calls the driver | Kernel | Your driver never calls it directly. The framework calls **your** functions. |
| **Kernel APIs** (`gpiod_*`, `i2c_transfer()`, `devm_clk_get()`, ...) | Functions the kernel provides to access hardware and resources | Kernel | Your driver **calls** them. |
| **Driver structure** (`i2c_driver`, `spi_driver`, `platform_driver`, ...) | A struct that you fill in and register. It holds your driver's name, ID table, and callbacks such as `probe()` and `remove()`. | Defined by the kernel, filled in by you | Your driver **fills it in**, and the framework calls the callbacks inside it. |

Only the code you write is the driver. Bus core and driver core are part of the kernel.

A driver structure plays a role similar to a C++ class: you choose the one that matches your hardware, fill in its fields, and the framework calls your functions. C has no inheritance, so it is only a struct of data and function pointers.

### Choose the driver structure by bus

| Hardware | Bus it is on | Driver structure |
|---|---|---|
| SoC-integrated controller, not on any scannable bus | Platform bus (virtual) | `platform_driver` |
| Chip on an I2C bus | I2C bus | `i2c_driver` |
| Chip on an SPI bus | SPI bus | `spi_driver` |
| PCIe device | PCI bus | `pci_driver` |
| USB device | USB bus | `usb_driver` |

### The platform bus

The platform bus is virtual: it exists only in the kernel, with no physical wires. The kernel puts non-discoverable SoC-integrated devices on it, such as the I2C, SPI, and UART controllers, so they use the same matching flow as devices on real buses. The hardware on it is real: the CPU accesses it directly through register addresses.

| Structure | Bus | Hardware it drives |
|---|---|---|
| `i2c_driver` | I2C bus (real wires) | A chip connected to an I2C bus, such as a temperature sensor |
| `platform_driver` | {{< term "platform bus" "A virtual bus with no physical wires. The kernel puts devices that are not on any scannable bus onto it, so they can use the same matching flow as other devices." >}} | An SoC-integrated controller, such as a UART, I2C, or SPI controller, described by the Device Tree |

One I2C path uses both structures: the SoC's I2C controller is driven by a `platform_driver`, and the sensor on that bus is driven by an `i2c_driver`.

### Matching flow

| Step | Who does it | What happens |
|---|---|---|
| 1 | Your driver | Fills in the driver structure (`probe()`, `remove()`, ID table or `compatible`) and registers it with the bus |
| 2 | Kernel bus / firmware code | Enumerates devices on buses such as PCI/USB, or creates devices from firmware descriptions such as the Device Tree |
| 3 | Bus core | Matches a device to a driver, for example by `compatible` |
| 4 | Driver core | Calls your driver's `probe()` |
| 5 | Your driver | In `probe()`, calls kernel APIs to get resources and set up the hardware |
| 6 | Driver core | When the device is removed or unbound, calls `remove()` (USB uses `disconnect()`) |

Use the subsystem APIs. Do not bypass the framework, or your driver will conflict with the kernel's device management.

### Platform driver example

The driver registers a `platform_driver`. In `probe()`, it reads the resources from its own Device Tree node (register address, interrupt, clock) through kernel APIs, then initializes the controller:

| Resource | Kernel API to call | Where it comes from in the DT |
|---|---|---|
| Register memory | `devm_platform_ioremap_resource(pdev, 0)` | First `reg` entry |
| Interrupt | `platform_get_irq(pdev, 0)` | First `interrupts` entry |
| Clock | `devm_clk_get(dev, NULL)` | `clocks` property |

```c
static int example_probe(struct platform_device *pdev)
{
	struct device *dev = &pdev->dev;
	void __iomem *regs;
	struct clk *clk;
	int irq;

	/* 1. Map the registers */
	regs = devm_platform_ioremap_resource(pdev, 0);
	if (IS_ERR(regs))
		return dev_err_probe(dev, PTR_ERR(regs), "failed to map registers\n");

	/* 2. Get the interrupt number */
	irq = platform_get_irq(pdev, 0);
	if (irq < 0)
		return dev_err_probe(dev, irq, "failed to get IRQ\n");

	/* 3. Get the clock */
	clk = devm_clk_get(dev, NULL);
	if (IS_ERR(clk))
		return dev_err_probe(dev, PTR_ERR(clk), "failed to get clock\n");

	/* Use regs, irq, and clk to initialize the device. */
	return 0;
}
```

#### When a resource is not ready

The clock is provided by a separate clock controller driver. If that driver has not finished its `probe()` yet, the clock does not exist yet, and `devm_clk_get()` returns {{< term "-EPROBE_DEFER" "An error code meaning 'a resource I need is not ready yet, try again later'." >}}.

One clock can be used by many drivers. The kernel keeps a use count and turns the clock off only when no driver needs it.

| Do | Don't |
|---|---|
| `return dev_err_probe(...)`: pass the error back. The driver core retries `probe()` after another device probes successfully. ({{< term "deferred probe" "When a driver's probe() cannot finish because a resource it needs is not ready yet, it returns -EPROBE_DEFER. The driver core postpones the probe and retries it after another device probes successfully." >}}) | Loop and poll inside `probe()` until the clock appears. It blocks other drivers, and may wait forever. |

## Per-Interface Notes

### GPIO, I2C, SPI, and UART

Each interface has its own kernel subsystem. The driver fills in the matching **driver structure** and calls that subsystem's **kernel APIs**.

| Interface | What it is | Driver structure to fill in | Kernel APIs to call | Watch out for |
|---|---|---|---|---|
| GPIO | A single pin, driven or read as high or low | None. Use the structure of the device that owns the pin (for example `i2c_driver`). | `gpiod_*` functions | Get the pin from the Device Tree. Do not hard-code a pin number: "GPIO 12" can be a different pin on another board. To use the pin as an interrupt, convert it with `gpiod_to_irq()`. |
| I2C / SMBus | A 2-wire bus; each device has an address | `i2c_driver` | `i2c_transfer()`, SMBus helpers | Device address, message format, bus errors, retries. Userspace should not access an address that a kernel driver already owns. |
| SPI | A 4-wire bus; each device is selected by a {{< term "chip select" "A dedicated signal line that tells one SPI device it is the one being talked to." >}} | `spi_driver` | `spi_sync()`, `spi_async()` | Mode, word size, maximum clock, chip select, splitting data into messages. |
| UART | A serial link between two devices | UART controller: `platform_driver`, registered with the {{< term "serial core" "The kernel framework that exposes a UART controller as a console or TTY." >}}. Chip on a UART: `serdev_device_driver`. | Serial core and {{< term "serdev" "A framework that lets a kernel driver sit on top of a UART to control an external chip, such as a Bluetooth module." >}} APIs | Use serial core for the UART controller itself. Use serdev when the driver is for a chip connected to the UART. |

### PCIe and USB

These buses can be scanned, so devices are found automatically.

| Interface | Driver structure to fill in | Kernel APIs to call | Watch out for |
|---|---|---|---|
| PCI / PCIe | `pci_driver` | `pci_enable_device()`, `pci_request_regions()`, `pci_iomap()` | Access a {{< term "BAR" "Base Address Register: the register region of a PCIe device. It must be mapped before use, not treated as a physical address." >}} through `pci_iomap()`. Interrupts use {{< term "MSI/MSI-X" "PCIe interrupt methods that send a message instead of using a physical interrupt line." >}} or legacy APIs. Set the DMA mask. |
| USB | `usb_driver`, with a USB ID table | URB or synchronous transfer APIs | Hot-unplug, transfer cancellation, completion callback lifetime. |

Even though PCIe and USB devices are found by scanning, the driver must still handle device removal, power management, and transfer errors.

## Implementation Checklist

1. Identify the device's bus or subsystem, then choose the matching driver structure.
2. Describe hardware resources using the official binding and device documentation.
3. Read the subsystem's API documentation. Validate resources and initialize the device in `probe()`, with safe error unwinding.
4. Determine whether suspend/resume, hotplug, or deferred probing applies.

## References

- [Linux Devicetree documentation](https://docs.kernel.org/devicetree/)
- [Linux GPIO consumer interface](https://docs.kernel.org/driver-api/gpio/consumer.html)
- [Linux I2C subsystem](https://docs.kernel.org/driver-api/i2c.html)
- [Linux SPI subsystem](https://docs.kernel.org/driver-api/spi.html)
- [Linux PCI driver guide](https://docs.kernel.org/PCI/pci.html)
- [Linux USB API](https://docs.kernel.org/driver-api/usb/)