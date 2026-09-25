---
title: "Verilog Blocking and Non-blocking Assignments"
weight: 2
date: 2026-10-03T16:30:00+08:00
draft: false
---

## Overview

Verilog has two procedural assignment operators:

| Operator | Name | Typical use |
|----------|------|-------------|
| `=` | Blocking assignment | Combinational logic |
| `<=` | Non-blocking assignment | Clocked sequential logic |

The key difference is when the left side changes. With `=`, it changes right away. With `<=`, Verilog reads the right side now, then updates the left side after the current block finishes. It still updates in the same time step, not at the next clock.

## Blocking Assignment

With `=`, each statement completes its assignment before the next statement runs. Later statements can therefore read values assigned earlier in the same procedural block.

```verilog
always @(*) begin
    next_value = input_value;
    if (enable)
        next_value = 1'b0;
end
```

Blocking assignments are the usual choice for combinational logic. Assign all outputs on every path to avoid inferring a latch.

## Non-blocking Assignment

With `<=`, statements in a procedural block still execute in order, but the left-hand sides do not change immediately. Each right-hand side is evaluated as its statement executes; the scheduled register updates take effect after the active procedural statements finish.

```verilog
always @(posedge clk) begin
    a <= b;
    b <= a;
end
```

If `a` is `0` and `b` is `1` just before the rising edge:

1. The first statement schedules `a` to receive the old value of `b` (`1`).
2. The second statement schedules `b` to receive the old value of `a` (`0`).
3. Both updates take effect in the non-blocking assignment update region: `a` becomes `1` and `b` becomes `0`.

The registers exchange values. The block did execute statement-by-statement; it is the register updates that were deferred.

## Why Use `<=` for Clocked Logic?

Clocked registers sample their inputs at a clock edge and update as a group. Non-blocking assignments model this behavior and prevent one register's update from accidentally affecting another register's calculation in the same clocked block.

For example, using blocking assignments here can make the result depend on statement order:

```verilog
always @(posedge clk) begin
    a = b;
    b = a;
end
```

If `a` is `0` and `b` is `1` before the edge, the first assignment immediately changes `a` to `1`; the next statement then reads that new `a`, so both registers become `1`. This does not exchange the old register values.

## Coding Guidelines

- Use blocking assignments (`=`) in combinational procedural blocks such as `always @(*)`.
- Use non-blocking assignments (`<=`) in clocked sequential blocks such as `always @(posedge clk)`.
- Avoid mixing `=` and `<=` for the same register across procedural blocks; that can cause race conditions and simulation/synthesis mismatches.
- In a clocked block, if the same register is assigned more than once, the last executed non-blocking assignment determines its scheduled value.

## Important Note

“Both update together” describes the RTL simulation scheduling and the intended synchronous register behavior. Real hardware has clock-to-Q and routing delays, so physical signals do not change with zero delay.

## Next

- [Verilog RTL and Behavioral Simulation Flow](verilog-rtl-simulation-flow.md)
