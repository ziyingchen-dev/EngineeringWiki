---
title: "Verilog RTL and Behavioral Simulation Flow"
weight: 3
date: 2026-10-03T14:00:00+08:00
draft: false
---

## Overview

Scope: write RTL, write a testbench, run behavioral simulation.

| Stage | Input | Output | Tool |
|-------|-------|--------|------|
| RTL design | Spec | `rtl/*.v` | Editor |
| Testbench | Spec | `tb/*_tb.v` | Editor |
| Compile | `.v` + testbench | `sim/*_tb` | `iverilog` |
| Run | `sim/*_tb` | `.vcd` + PASS/FAIL | `vvp` |
| View | `.vcd` | Waveform | `gtkwave` |

---

## Project Structure

```text
NN-name/
├─ rtl/    # design source
├─ tb/     # testbench
├─ sim/    # build output (executable, .vcd)
├─ images/ # waveform screenshots
└─ README.md
```

---

## Command Flow

Run from the project root.

```bash
mkdir -p sim
iverilog -o sim/led_blink_tb rtl/led_blink.v tb/led_blink_tb.v   # compile
vvp sim/led_blink_tb                                             # run
gtkwave sim/led_blink.vcd                                        # view
```

---

## RTL Basics

```verilog
module led_blink (
    input  wire clk,
    input  wire rst_n,
    output reg  led
);

    parameter TARGET_COUNT = 9;
    reg [31:0] counter;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            counter <= 0;
            led     <= 0;
        end else if (counter == TARGET_COUNT) begin
            counter <= 0;
            led     <= ~led;
        end else begin
            counter <= counter + 1;
        end
    end

endmodule
```

| Item | Rule |
|------|------|
| `wire` | Combinational connection; driven by `assign` or a module output |
| `reg` | Assigned inside `always` or `initial` |
| Sequential logic | `always @(posedge clk)` with non-blocking `<=` |
| Combinational logic | `always @(*)` with blocking `=` |
| Async reset | Add `or negedge rst_n` to the sensitivity list |
| End of module | `endmodule` is required |

---

## Testbench Basics

```verilog
`timescale 1ns/1ps

module led_blink_tb;

    reg  clk;
    reg  rst_n;
    wire led;

    led_blink dut (.clk(clk), .rst_n(rst_n), .led(led));   // DUT

    always #5 clk = ~clk;                                  // 100 MHz clock

    initial begin
        $dumpfile("sim/led_blink.vcd");                    // waveform output
        $dumpvars(0, led_blink_tb);

        clk = 0; rst_n = 0;                                // reset
        #20 rst_n = 1;                                     // release

        // stimulus and checks
        #100;                                              // t = 120 ns, led toggled at 115 ns
        if (led !== 1'b1) $display("ERROR: unexpected led");
        else              $display("PASS");

        $finish;
    end

endmodule
```

| Part | Purpose |
|------|---------|
| `timescale` | Time unit / precision |
| DUT instance | Connects the design under test |
| Clock | `always #5 clk = ~clk;` (period 10 ns) |
| `$dumpfile` / `$dumpvars` | Generate `.vcd` |
| Self-check | `if (... !== ...)` + `$display` PASS/ERROR |
| `$finish` | End simulation |

---

## Next

- [Chapter 01 - LED Blink](https://github.com/ziyingchen-dev/FpgaLearningLab/tree/main/01-led)
- [Chapter 02 - Key Input](https://github.com/ziyingchen-dev/FpgaLearningLab/tree/main/02-key)