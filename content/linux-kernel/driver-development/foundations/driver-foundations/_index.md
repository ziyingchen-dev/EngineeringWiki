---
title: "Driver Foundations and Architecture"
weight: 1
date: 2026-10-04T19:12:00+08:00
draft: false
aliases:
  - "/linux-kernel/driver-foundations/"
---

## What a Linux Driver Does

A Linux driver connects <span class="term-blue">hardware or a virtual device</span> to the {{< term "kernel device model" "The Linux kernel device model provides a common framework for representing devices, drivers, and buses and their relationships; selected objects and attributes are exposed through sysfs." >}} and {{< term "subsystem" "The part of the kernel that handles one class of hardware, such as I2C, SPI, or networking." >}} interfaces. Most drivers do not invent a userspace interface of their own; they register with an existing {{< term "framework" "The structures and callbacks a subsystem provides. A driver fills in the callbacks and registers with it." >}} such as I2C, SPI, networking, ALSA, or V4L2. The framework provides common lifecycle and {{< term "interfaces" "data structures and callbacks" >}}, while the driver implements device-specific behavior.

Before writing a driver, confirm:
1. Does the kernel already have a driver for this hardware? (If yes, enable or extend it instead of rewriting.)
2. Which subsystem does it belong to? (The driver registers with that framework, which defines the API.)
3. Which kernel version is targeted? (Framework APIs change between versions.)
4. How are the hardware resources (register addresses, IRQs, clocks) described? (DT / ACPI)

References: `Documentation/driver-api/` in the kernel source tree and the per-subsystem documentation.

## Kernel Module Lifecycle

Depending on its Kconfig configuration, the same driver source can often be built into the kernel or compiled as a loadable module.

| | Built-in | Loadable |
|---|---|---|
| Form | Linked into the kernel image | Separate {{< term "loadable module" "A .ko file that can be inserted into or removed from a running kernel." >}} |
| `module_init()` | Registered as an {{< term "initcall" "Initialization functions that the kernel runs once each during boot. Each initcall is assigned to a level based on its kind (for example, core, subsys, or device), and the levels run in order. A built-in driver's module_init() is a device-level initcall." >}}; runs automatically during boot | Runs when the module is loaded |
| `module_exit()` | Never called; the driver cannot be unloaded | Runs when the module is unloaded |

During boot, the kernel has many initcalls. Each one is assigned to one of several ordered levels. The kernel runs the levels in order, and finishes all initcalls in one level before starting the next. Within a level, it calls them one at a time.

A built-in driver's `module_init()` is one of these initcalls, assigned to the device level. All built-in drivers share this level.

```text
Early levels:      platform bus init
                   I2C core init
                   SPI core init
                   ...
Level 6 (device):  driver A module_init()
                   driver B module_init()
                   driver C module_init()
                   ...
Level 7 (late):    other late init
                   ...
```

Bus and subsystem initcalls are assigned to earlier levels, so the buses already exist when the drivers register in the device level.

### Loading a Loadable Module

| Command | Behavior | Use |
|---|---|---|
| `insmod ./example.ko` | Loads only the specified file; does not resolve dependencies | Development |
| `modprobe example` | Loads by name; loads dependencies first | Normal system use |

For `modprobe`, the `.ko` must be installed under `/lib/modules/$(uname -r)/`, and `depmod` must update the {{< term "module dependency database" "An index of installed kernel modules and the other modules required by each one." >}}.

Each loaded `.ko` runs its own `module_init()`. When `modprobe` loads dependencies, each dependency's `module_init()` runs before the requested module's `module_init()`.

### Driver Registration and Device Probe

For both built-in and loadable drivers, `module_init()` usually does not initialize the hardware directly. Instead, it registers a {{< term "bus driver" "A driver registered with a bus framework, such as platform, I2C, or SPI, so the bus can match it with devices." >}}. After the bus finds a matching device, it calls `probe()`.

`module_init()` runs once. `probe()` runs once per matching device, so one registration may cause zero, one, or multiple `probe()` calls. A successful module load therefore does not guarantee that `probe()` ran or succeeded.

```c
static int example_probe(struct platform_device *pdev)
{
    pr_info("example: probe\n");
    return 0;
}

static void example_remove(struct platform_device *pdev)
{
    pr_info("example: remove\n");
}

static struct platform_driver example_driver = {
    .probe  = example_probe,
    .remove = example_remove,
    .driver = {
        .name = "example",
    },
};

static int __init example_init(void)
{
    return platform_driver_register(&example_driver);
}

static void __exit example_exit(void)
{
    platform_driver_unregister(&example_driver);
}

module_init(example_init);
module_exit(example_exit);

MODULE_LICENSE("GPL");
MODULE_DESCRIPTION("Example driver");
```

- `example_init()` registers the driver. When a matching platform device is found, the platform bus calls `example_probe()`.
- For a loadable module, `example_exit()` unregisters the driver. The bus then calls `example_remove()` for each bound device.
- If `probe()` fails partway, release every {{< term "non-devm resource" "A resource obtained without a devm helper, such as memory from kmalloc() or an IRQ from request_irq(). The driver must release it explicitly." >}} already acquired, then return an error code.

### Common Module Commands

```bash
sudo insmod ./example.ko   # Load a .ko directly (development)
sudo modprobe example      # Load an installed module with its dependencies
lsmod                      # Check whether the module is loaded
dmesg | tail               # Read recent kernel messages
sudo rmmod example         # Unload by module name, without the .ko suffix
```

## Character Devices and Userspace Interfaces

A {{< term "character device" "A device represented as a file node under /dev that a program accesses through open, read, write, and close, transferring data as a sequential stream of bytes, like a serial port." >}} is the way a {{< term "userspace" "Normal programs running outside the kernel. They cannot touch hardware directly and must ask the kernel." >}} program talks to your driver through a file. Use it when the driver needs to send and receive byte streams, or accept commands.

To build one, the kernel needs three things:

| Item | What it is |
|---|---|
| {{< term "device number" "A pair of numbers that identifies a device. The major number picks the driver, and the minor number picks which device of that driver." >}} | A major/minor pair that names your device. |
| `struct cdev` | The kernel object for your character device. It links the device number to your operations. |
| `struct file_operations` | A table of your functions. The kernel calls them when a program opens, reads, writes, or controls the device. |

### Operations you can provide

- `open()` / `release()`: called when a program opens or closes the device file. The program holds the open file as a {{< term "file descriptor" "A small integer the kernel gives a program to refer to an open file." >}}.
- `read()` / `write()`: move data between the driver and the program. Use {{< term "copy_to_user() / copy_from_user()" "Kernel functions that safely copy data between kernel memory and userspace memory. The kernel must never use a userspace pointer directly." >}} for the copy. A call may move fewer bytes than asked, so return how many bytes you actually moved, or a negative error code if it failed.
- `unlocked_ioctl()`: handles commands that are not data, such as "set the speed" or "reset the device". A program sends the command with {{< term "ioctl" "A system call that sends a command number, and optionally one piece of data, to a driver." >}}.
- `poll()`: lets a program wait until data is ready or the state changes. Programs wait with `poll()`, `select()`, or {{< term "epoll()" "A Linux system call for waiting on many file descriptors at once, until one of them is ready." >}}.

### ioctl command numbers

Each ioctl command is one integer. Build it with the macros {{< term "_IO, _IOR, _IOW, _IOWR" "Macros that pack the data direction, a type character, a command index, and the data size into one command number. _IO has no data, _IOR reads from the driver, _IOW writes to the driver, _IOWR does both." >}} instead of choosing a number yourself.

```c
#define MY_MAGIC   'x'
#define MY_SET_VAL _IOW(MY_MAGIC, 1, int)   /* the program sends one int to the driver */
```

After you release a command, never change its number or its data layout, and keep the layout the same on 32-bit and 64-bit systems. Otherwise old programs break. This is what keeping the {{< term "ABI" "Application Binary Interface. The binary-level contract between the kernel and programs that are already compiled. If it stays stable, old programs keep working after a kernel update without being rebuilt." >}} stable means.

### Creating the device

1. Call `alloc_chrdev_region()` to get a device number from the kernel.
2. Register your `cdev`.
3. Create the device through the {{< term "device model" "The kernel's common way of representing every device, driver, and bus as objects, and exposing them through sysfs." >}}.

The file a program opens is a {{< term "/dev node" "A file under /dev that represents a device. Opening it reaches the driver." >}}. You normally do not create it yourself: {{< term "devtmpfs" "A kernel-managed filesystem mounted at /dev. It creates a node automatically when a device appears." >}} and {{< term "udev" "A userspace service that reacts to device events. It sets the node name, owner, and permissions under /dev." >}} do it for you. Do not depend on a fixed major/minor number or on creating the node by hand with `mknod`.

### Which Interface Replaces /dev

Do not mix up the two kinds of I2C devices. An I2C bus and a chip on that bus are separate devices with separate drivers.

| | I2C bus (adapter) | Chip on the bus (for example, a temperature sensor) |
|---|---|---|
| Example name | `i2c-3` | `3-0048` (bus 3, address 0x48) |
| Driver | The controller driver | The chip driver |
| sysfs | `/sys/class/i2c-adapter/i2c-3` | `/sys/bus/i2c/devices/3-0048` |
| `/dev` node | `/dev/i2c-3`, created by the generic {{< term "i2c-dev" "A generic kernel driver that creates a /dev/i2c-N node for every I2C bus, so programs can send raw transfers to any address on the bus." >}} driver | Normally none |
| What a program sees | Raw reads and writes to any address | A converted value, such as `temp1_input` |

`/dev/i2c-3` exists for programs that want to talk to the bus directly. Tools such as `i2cdetect`, `i2cget`, `i2cset`, and `i2cdump` (from the {{< term "i2c-tools" "A set of command-line programs for scanning an I2C bus and reading or writing chip registers from userspace." >}} package) open this file, pick a chip address with `ioctl()`, and then send raw bytes. The bus controller driver only moves the bytes; it does not interpret them. For example, `i2cget -y 3 0x48 0x00` reads register 0x00 of the chip at address 0x48 on bus 3.

The chip driver does not create a `/dev` node. It reads the chip registers, converts them to a temperature, and publishes the result through {{< term "hwmon" "The kernel subsystem for hardware monitoring chips such as temperature, voltage, and fan sensors. It shows each reading as a file in sysfs." >}}, for example `/sys/class/hwmon/hwmon1/temp1_input`. A program reads it with `cat`, and does not need to know any register address.

If a chip is already bound to its driver, do not also access it through `/dev/i2c-3`. The two paths can interfere with each other, and `i2cdetect` shows `UU` at that address to warn you.

Pick the interface by what you need:

| You need | Use |
|---|---|
| Raw access to a whole I2C bus for testing or bring-up | The generic `/dev/i2c-N` node from i2c-dev |
| A reading or setting from one chip, such as temperature | {{< term "sysfs" "A filesystem mounted at /sys. It shows kernel devices and drivers as files, and is the standard place for device attributes." >}} through the subsystem, such as hwmon |
| To send and receive network packets | Programs use a {{< term "socket" "A communication endpoint a program creates with the socket() call to send and receive packets over the network." >}}. They do not open a device file. The kernel exposes the network card as a {{< term "network interface" "The kernel object that represents one network card or Ethernet controller. It has a name such as eth0, which tools such as ip and ethtool use to select it." >}} named `eth0`, and sends the packets out through it. There is no `/dev/eth0` |
| To restart a network driver without rebooting | The `unbind` and `bind` files in the driver's sysfs directory |
| A custom byte stream or custom commands that no subsystem covers | Your own character device and `/dev` node |
| Debugging during development | {{< term "debugfs" "A filesystem mounted at /sys/kernel/debug. It is for debugging only, and its files are not a stable interface." >}} |

> **Note:** How to tell whether a device class has a `/dev` node: check how programs normally use it. If they open a file and call `read()` / `write()` (serial ports, disks, RTC, watchdog), it has a `/dev` node. If they use another interface (sockets for network cards, sysfs files for hwmon sensors), it does not.
>
> To check, pick a device from `/sys/class/<class>/` and see whether the same name exists under `/dev`:
>
> ```bash
> ls /sys/class/net     # eth0 exists, but ls /dev/eth0 fails
> ls /sys/class/tty     # ttyS0 exists, and ls /dev/ttyS0 succeeds
> ```

A network card shows how this works. On an ASPEED BMC, the Ethernet controller is a platform device named `14060000.ethernet`, and the `ftgmac100` driver controls it. The card appears in two places, and neither is under `/dev`:

| Name or path | What it is |
|---|---|
| `eth0` | The network interface. Programs use sockets, and tools such as `ip` and `ethtool` use this name. It carries the packets. |
| `/sys/bus/platform/devices/14060000.ethernet` | The device in the device model. Its `driver` link points to `ftgmac100`. |

To detach and re-attach the driver, write the device name to the `unbind` and `bind` files of the driver:

```bash
echo -n "14060000.ethernet" > /sys/bus/platform/drivers/ftgmac100/unbind
echo -n "14060000.ethernet" > /sys/bus/platform/drivers/ftgmac100/bind
```

`unbind` calls the driver's `remove()`, and `eth0` disappears. `bind` matches the driver to the device again, the kernel calls `probe()`, and `eth0` comes back. This is the same `probe()` and `remove()` pair described earlier, triggered by hand.

Do not use {{< term "procfs" "A filesystem mounted at /proc. It shows process and kernel information." >}} for new hardware control. It is meant for process and kernel information. debugfs files are not a stable ABI, so do not build a product on them.

## Resource Management and Error Handling

Use `devm_*` APIs for resources tied to a device's lifecycle when appropriate; they are released automatically when the device detaches. They do not manage every non-devm resource or remove the need for concurrency control. Non-devm resources need clear error-unwind and remove paths. Return specific error codes and emit an appropriate amount of diagnostic output using kernel conventions.

## Checklist

- Is the device registered and matched through the correct bus or subsystem?
- Are resources released correctly if `probe()` fails partway through?
- During `remove()` or module unload, are new operations stopped and asynchronous work drained?
- Is a userspace ABI necessary, documented, and validated?
- Can the normal device model support multiple instances instead of assuming one global device?

## References

- [Linux driver model](https://docs.kernel.org/driver-api/driver-model/)
- [Linux kernel coding style](https://docs.kernel.org/process/coding-style.html)
- [Linux kernel source: `drivers/`](https://elixir.bootlin.com/linux/latest/source/drivers)