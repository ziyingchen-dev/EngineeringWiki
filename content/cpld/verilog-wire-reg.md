---
title: "Verilog wire and reg"
weight: 2
date: 2026-10-11T23:00:00+08:00
draft: false
---

## Overview

`wire` and `reg` are declared in a module's port list or body, not inside an `always` block. A `wire` is driven by `assign` or another module's output. A `reg`'s value is normally assigned by statements inside procedural blocks such as `always` or `initial`. Verilog also allows an initial value in the declaration, such as `reg q = 1'b0;`; whether synthesis implements that initial value in hardware depends on the target device and tool. This assignment rule applies to both synthesizable modules and testbenches. For example, assigning a `reg` in `always @(*)` on every path describes combinational logic; assigning it in `always @(posedge clk)` describes a {{< term "flip-flop" "A circuit that stores one bit of data and updates its output in response to a clock edge." >}}.

| Type | How its value is driven | Common uses |
|------|-------------|-------------|
| `wire` | `assign` or a module output | Connections and continuous combinational logic |
| `reg` | A procedural block such as `always` or `initial` | Procedural combinational logic, sequential logic, and testbench stimulus |

Normally, assign a `reg` inside an `always` or `initial` block. You can also set its initial value in the declaration, outside these blocks: `reg q = 1'b0;`. Whether synthesis supports this initial value depends on the CPLD and tool.

These examples use Verilog-2001 syntax.

## 1. Continuous Combinational Logic: `wire`

Use `wire` when driving a signal with a continuous `assign` statement:

```verilog
module and_gate (
    input  wire a,
    input  wire b,
    output wire y
);
    assign y = a & b;
endmodule
```

The assignment is continuously evaluated as its inputs change. A `wire` cannot be assigned directly inside an `always` block.

## 2. Combinational Logic in an `always` Block: `reg`

In Verilog, a signal assigned in an `always` block must be declared as `reg`:

```verilog
module mux2 (
    input  wire a,
    input  wire b,
    input  wire sel,
    output reg  y
);
    always @(*) begin
        if (sel)
            y = b;
        else
            y = a;
    end
endmodule
```

Assign the output on every possible path. This example describes combinational logic; `reg` here does not mean that a flip-flop is inferred. If a path does not assign the output, the hardware must retain its previous value. Synthesis may create a {{< term "latch" "A level-sensitive storage circuit that holds its previous output while disabled and follows its input while enabled." >}} to provide that storage. For example:

```verilog
always @(*) begin
    if (enable)
        q = d;
end
```

When `enable` is `0`, `q` is not assigned, so it must keep its old value. That behavior infers a latch instead of pure combinational logic.

## 3. Clocked Sequential Logic: `reg`

Use `reg` for values assigned by a clocked `always` block. Non-blocking assignments (`<=`) are the standard style for sequential logic:

```verilog
module dff (
    input  wire clk,
    input  wire d,
    output reg  q
);
    always @(posedge clk) begin
        q <= d;
    end
endmodule
```

This describes a flip-flop because the value changes on a clock edge, not because the signal is declared `reg`.

## 4. Resettable Sequential Logic: `reg`

An **asynchronous reset** takes effect as soon as the reset signal is asserted; it does not wait for a clock edge. Here, `negedge rst_n` means the reset is active when `rst_n` falls to `0`:

```verilog
module resettable_dff (
    input  wire clk,
    input  wire rst_n,
    input  wire d,
    output reg  q
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            q <= 1'b0;
        else
            q <= d;
    end
endmodule
```

A **synchronous reset** takes effect only at the active clock edge. Here, the reset is checked at `posedge clk`, so asserting `rst_n` between clock edges does not immediately change `q`:

```verilog
always @(posedge clk) begin
    if (!rst_n)
        q <= 1'b0;
    else
        q <= d;
end
```

## 5. Internal Signals and Module Connections: `wire`

Use a `wire` to connect a submodule output to another signal:

```verilog
module inverter (
    input  wire a,
    output wire y
);
    assign y = ~a;
endmodule

module top (
    input  wire a,
    output wire y
);
    wire inverted;

    inverter u_inverter (
        .a(a),
        .y(inverted)
    );

    assign y = inverted;
endmodule
```

A submodule input can be driven by either a `wire` or a `reg` signal. A submodule output is normally connected to a `wire`.

## 6. Module Output Declarations

In Verilog-2001, declare an output driven by `assign` as `output wire`, and an output assigned in a procedural block as `output reg`:

```verilog
module output_examples (
    input  wire clk,
    input  wire a,
    output wire y,
    output reg  q
);
    assign y = ~a;

    always @(posedge clk)
        q <= a;
endmodule
```

## 7. Buses, Concatenation, and Bit Selects

Both types can be vectors. Choose the type based on how the signal is driven:

```verilog
module bus_example (
    input  wire       clk,
    input  wire [3:0] switches,
    output reg  [7:0] saved_value
);
    wire [7:0] bus_value;

    assign bus_value = {4'b0000, switches};

    always @(posedge clk)
        saved_value <= bus_value;
endmodule
```

`[7:0]` declares an eight-bit vector. `switches[3:0]` selects four bits, and `{...}` concatenates values.

## 8. Bidirectional Pins and High Impedance

An `inout` pin is declared as a net. A tri-state assignment can release the pin by driving `1'bz`:

```verilog
module bidirectional_pin (
    inout  wire io_pin,
    input  wire output_enable,
    input  wire output_data,
    output wire input_data
);
    assign io_pin = output_enable ? output_data : 1'bz;
    assign input_data = io_pin;
endmodule
```

Use this pattern only for supported top-level I/O pins. CPLD families and synthesis tools can differ in how they support internal tri-state logic.

## 9. Testbench Stimulus and DUT Outputs

Testbench signals assigned in `initial` or `always` blocks are declared `reg`. Signals driven by the device under test (DUT) are commonly declared `wire`:

```verilog
module example_tb;
    reg  clk;
    reg  d;
    wire q;

    dff dut (
        .clk(clk),
        .d(d),
        .q(q)
    );

    always #5 clk = ~clk;

    initial begin
        clk = 1'b0;
        d = 1'b0;
        #10 d = 1'b1;
        #10 $finish;
    end
endmodule
```

The testbench drives `clk` and `d`; the DUT drives `q`.

## Common Rules

- Use `wire` for signals driven by `assign` or module outputs.
- Use `reg` for signals assigned inside Verilog procedural blocks.
- Use blocking assignments (`=`) in combinational `always @(*)` blocks.
- Use non-blocking assignments (`<=`) in clocked `always` blocks.
- Do not drive the same signal from multiple procedural blocks or conflicting drivers.

## Next

- [Verilog Blocking and Non-blocking Assignments](verilog-blocking-nonblocking.md)
- [Verilog RTL and Behavioral Simulation Flow](verilog-rtl-simulation-flow.md)
