---
title: "CPLD/FPGA Vendors and Development Tools"
weight: 1
date: 2026-10-03T13:02:00+08:00
draft: false
---

## Overview

CPLD and FPGA are both programmable logic. Three vendors cover most learning boards: Intel (Altera), AMD (Xilinx), and Lattice.

| Feature | CPLD | FPGA |
|---------|------|------|
| Logic scale | Thousands of units | Up to millions of units |
| Power | Low | Higher |
| Start-up | Instant (on-chip flash) | Slower (loads bitstream) |
| Cost | Low | Higher |
| Typical use | Glue logic, state machines | Computation, signal processing |

---

## Vendor Summary

| | Intel (Altera) | AMD (Xilinx) | Lattice |
|---|---|---|---|
| Tool | Quartus Prime Lite | Vivado | Diamond / iCEcube2 / open-source |
| CPLD | MAX V (5M570Z) | CoolRunner-II (XC2C256) | MachXO3 (LCMXO3LF-6900) |
| Entry FPGA | MAX 10 (10M08), Cyclone IV (EP4CE6/10) | Spartan-7 (XC7S), Artix-7 (XC7A35T) | iCE40 (HX1K, UP5K), ECP5 (LFE5U-25F) |
| Simulator | ModelSim (bundled) | Vivado Simulator | iverilog + GTKWave |
| Free license | Lite edition | WebPACK | Free license (Diamond) / fully open-source |
| Programmer | USB Blaster | Digilent JTAG-HS3 / onboard FTDI | iceprog / openFPGALoader |
| Output file | `.sof` (SRAM), `.pof` (flash) | `.bit` (SRAM), `.mcs` (flash) | `.bin` (iCE40), `.jed` / `.bit` (MachXO3 / ECP5) |

Notes:
- Legacy tools (ISE, ispLEVER) are deprecated and not covered.
- Lattice: iCE40 uses iCEcube2 or Yosys + nextpnr; Diamond covers MachXO3 and ECP5.

---

## Simulation

| Type | Stage | Purpose | Flow |
|------|-------|---------|------|
| Behavioral | Pre-synthesis | Verify logic, no delays | Write testbench → simulate → view waveform |
| Functional | Post-synthesis | Verify netlist, no routing delay | Synthesize → simulate netlist |
| Timing | Post-implementation | Verify timing with delays | Place and route → SDF back-annotation → simulate |

This course uses iverilog + GTKWave for behavioral simulation.

---

## Programming

| Mode | Retained after power-off |
|------|--------------------------|
| JTAG (SRAM) | No |
| Flash / SPI Flash | Yes |

Steps:
1. Generate the bitstream in the vendor tool.
2. Connect the programmer; confirm the device is detected.
3. Select the file and program.

Common issues:

| Symptom | Check |
|---------|-------|
| Device not detected | USB cable, driver, JTAG chain |
| Configuration lost on power-off | Program to flash, not SRAM |
| Boots fail after flash programming | SPI flash pins, boot mode |

---

## Beginner's Recommendation

- Board: pick by tool familiarity; iCE40 boards are cheapest and have an open-source flow.
- Path: Verilog basics → simulation (iverilog) → one entry FPGA board.

---

## References

- [Intel FPGA](https://www.intel.com/content/www/us/en/products/programmable.html)
- [AMD Xilinx](https://www.xilinx.com)
- [Lattice Semiconductor](https://www.latticesemi.com)