---
title: "UefiNexus Invalid-Goto Investigation"
weight: 4
date: 2026-10-03T22:54:00+08:00
draft: false
---

<style>
.term-blue {
  font-weight: 600;
  text-decoration: underline 3px #005A9C;
  text-underline-offset: 4px;
}
.term-red {
  font-weight: 600;
  text-decoration: underline 3px #D32F2F;
  text-underline-offset: 4px;
}
</style>

## Experiment Setup and Workflow

This experiment tested a two-tool issue-investigation workflow on a small repository, [UefiNexus](https://github.com/ziyingchen-dev/UefiNexus).

**Design history:** During UefiNexus development, IV asked Copilot for GitHub to change invalid-address behavior from rejecting the address and staying in place to allowing navigation and showing `??`. <span class="term-red">Copilot did not propagate the new behavior consistently through the project, leaving the old “stay on current page” message and assumptions.</span> The later RootPilot investigation and Copilot review were not given this design history.

1. **Fixture generation (Copilot for GitHub):** Scanned UefiNexus, identified a candidate bug, and prepared the investigation fixture (`examples/uefinexus/issue.md` and `logs.txt`).
2. **Investigation (RootPilot):** Ran against the fixture, traced the relevant source, and proposed a fix:

   ```bash
   python3 main.py investigate examples/uefinexus --provider=mistral
   ```

3. **Manual review loop (Copilot for GitHub):** The user pasted RootPilot's findings and proposed diff into Copilot for review, then pasted Copilot's feedback back into RootPilot as additional evidence. RootPilot revised its proposal. This loop was repeated manually.
4. **Retrospective (Copilot for GitHub and Codex):** Discussed the final results with both tools and re-examined the design assumptions and source behavior.

**Takeaway:** Copilot for GitHub acted as the reviewer and RootPilot as the investigator. The tools were not integrated, and RootPilot had no automated self-review. 
<span class="term-blue">An autonomous AI must combine both capabilities: investigate root causes and review its own output.</span>

## Summary

- **Symptom:** In QEMU, starting at `Addr: 0x0000000000000000` with the cursor at offset `0x80`, `Goto 0x1000000000000000` (invalid) leaves the view at `Addr: 0x1000000000000080` with every cell `??`. <span class="term-blue">However, the code's status message still says the view stays on the current page.</span>
- **Cause:** I asked Copilot for GitHub to change the design from reject-and-stay to navigate-and-show-`??`. Copilot did not propagate the change, leaving the old message behind. <span class="term-blue">RootPilot and its reviewer never got this history, treated the leftover as a local bug, and proposed a patch that restores the old design.</span>
- **Side finding:** ACPI/MMIO cells look browsable in PageMem, but `MemRead` never reads them and returns 0. A zero shown there (e.g. `00` for a byte) is a placeholder from the rejected read, not hardware data. (I had noticed this issue, but I had no idea what was causing it.)

## Allowlist Comparison

| UEFI type | PageMem (`IsDescriptorValid`) | NexusMemLib (`IsMemoryTypeValid`) |
|---|---|---|
| Conventional, Loader/BootServices/RuntimeServices (Code, Data) | Yes | Yes |
| ACPI Reclaim / NVS | **Yes** | **No** |
| MMIO / MMIOPortSpace | **Yes** | **No** |
| Other | No | No |

Only ACPI and MMIO differ. `MemRead`/`MemWrite` call `IsAddressValid()`, which finds the descriptor containing the address, then calls `IsMemoryTypeValid()` ([MemMap.c:190-215](https://github.com/ziyingchen-dev/UefiNexus/blob/main/UefiNexusPkg/Library/NexusMemLib/MemMap.c)).

## Terminology

- **Hole**: no descriptor covers the address. It has no tag (not `[UNK]`).
- **Tag**: derived from the UEFI type.

  | Tag | UEFI type | Browsable |
  |---|---|---|
  | `[RW]` | Conventional, BootServicesData, LoaderData, RuntimeServicesData | Yes |
  | `[RO]` | BootServicesCode, LoaderCode, RuntimeServicesCode | Yes |
  | `[ACPI]` | ACPIReclaim, ACPINVS | Yes |
  | `[MMIO]` | MemoryMappedIO, MemoryMappedIOPortSpace | Yes |
  | `[RSV]` | Reserved, PalCode | No |
  | `[BAD]` | Unusable | No |
  | `[UNK]` | Any other type | No |

- **`??`**: shown when `PageCoreIsRangeValid(Address, Width)` returns false. This is PageMem's browsability check, not a hardware read failure.

  | Cause | Condition |
  |---|---|
  | Hole | No descriptor covers the address |
  | Unbrowsable type | Descriptor is `[RSV]`, `[BAD]`, or `[UNK]` |
  | Boundary crossing | The `Width`-byte cell is not fully inside one browsable descriptor (even if the next one is adjacent) |

## Lessons

- LLMs can find relevant code in a small repo without specialized RAG.
- **Gap: design changes lose their history.** Copilot did not apply the owner's requested behavior change consistently. Later, RootPilot and its reviewer were never told about the change, so they treated the cursor change as a bug and followed the stale "reject and stay" message. That risked undoing the requested behavior.
- **What it should do:** <span class="term-red">when asked to change a design, check that the new behavior is consistent across code, messages, tests, and docs, and record the decision for future investigations.</span>
- **RAG:** RootPilot did not use RAG, so this experiment does not show that RAG caused the gap. A RAG-based system could still fall into a {{< term "local trap" "Sometimes code looks like a bug when viewed on its own, but it was designed that way for a specific reason. AI may try to fix the apparent bug without understanding that reason or the wider design. I call this a “local trap”. This is my name for the pattern." >}}.
- **Don't trust the agent's own labels:** confidence rose from 85% to 95% with no new evidence, and the "observed" line numbers were wrong. Verify with tools (`grep -n`, host tests, QEMU). What actually runs beats what the code seems to say.

## Raw RootPilot Investigation Transcript

The following is the investigation transcript supplied for this experiment, copied verbatim. It records the successive proposals, feedback, and acceptance; statements in the tool output are preserved as reported, not independently verified.

````c
brown@LAPTOP-ERMV6V13:~/RootPilot$ python3 main.py investigate examples/uefinexus --provider=mistral

================================================================================
Investigation Result
================================================================================
Investigation Summary

Confidence: 85%

Evidence Summary:
The PageMemActionGotoAddress function in PageMemActions.c updates the cursor state address to the aligned page but does not reset the cursor offset to 0 when the address is invalid, despite the status message claiming to stay on the current page. The test 'TestInvalidGotoReportsError' verifies the error is reported but does not check cursor/offset state preservation.

Hypotheses:
1. Invalid goto address does not reset cursor offset to 0, leaving it at the attempted offset (Evidence: PageMemActionGotoAddress only sets offset when address is valid; observed in PageMemActions.c lines 127-139)
2. Invalid goto address does not preserve the original page address (Evidence: PageMemActionGotoAddress always sets PageState->CursorState.Address to aligned input addressbefore validation; observed in PageMemActions.c line 127)
3. Insufficient evidence: No runtime logs or QEMU reproduction confirming the actual cursor/offset state after invalid goto

Recommended Investigation:
Add a test case in test_integration.c that verifies PageState->CursorState.Address and PageState->CursorState.Offset remain unchanged after an invalid goto address (e.g., 0x9000 in mock memory map)

Proposed Changes
--------------------------------------------------------------------------------
--- a/UefiNexusPkg/UI/Pages/PageMem/PageMemActions.c
+++ b/UefiNexusPkg/UI/Pages/PageMem/PageMemActions.c
@@ -153,6 +153,8 @@
     )
 {
     NX_U64 Address;
+    NX_U64 OriginalAddress;
+    NX_UINTN OriginalOffset;
 
     if (PageState == NULL || Adapters == NULL) {
         return NX_UI_INVALID_PARAMETER;
@@ -164,6 +166,9 @@
     if (!Adapters->Tui->ReadHex(&Address, 16)) {
         return NX_UI_ABORTED;
     }
+
+    OriginalAddress = PageState->CursorState.Address;
+    OriginalOffset  = PageState->CursorState.Offset;
 
     PageState->CursorState.Address = PageCoreAlignToPage(Address, PAGE_SIZE);
 
@@ -175,6 +180,8 @@
             L"Invalid address range - staying on current page"
             );
         Adapters->Error->ReportError(L"Invalid goto address", NX_UI_INVALID_PARAMETER);
+        PageState->CursorState.Address = OriginalAddress;
+        PageState->CursorState.Offset  = OriginalOffset;
         return NX_UI_INVALID_PARAMETER;
     }
 
--------------------------------------------------------------------------------

Actions
- [A] Accept
- [R] Provide Feedback
- [Q] Quit
Choice: R
Additional evidence: Please revise the fix to avoid mutating and then restoring cursor state. Calculate the aligned target address in a local variable, validate the full page range first, and only update CursorState.Address and CursorState.Offset after validation succeeds. Extend the existing TestInvalidGotoReportsError: first Goto to valid address 0x1080, record the cursor address and offset, reset the mock error count immediately before attempting invalid address 0x9000, then assert the invalid status, that an error was reported, and that both cursor fields remain unchanged. Run the host integration tests and report the results. Do not claim QEMU reproduction or validation.

================================================================================
Investigation Result
================================================================================
Investigation Summary

Confidence: 95%

Evidence Summary:
PageMemActionGotoAddress in PageMemActions.c unconditionally mutates CursorState.Address before validation (line 127), and only sets PageState->CursorState.Offset on success (line 139), leaving both fields in an inconsistent state on invalid input. The existing test_integration.c TestInvalidGotoReportsError only checks status and error reporting, not cursor state preservation.

Hypotheses:
1. Invalid goto address mutates CursorState.Address before validation, leaving it at the aligned invalid address when validation fails (Evidence: PageMemActionGotoAddress line 127 sets PageState->CursorState.Address = PageCoreAlignToPage(Address, PAGE_SIZE) before range check; observed)
2. Invalid goto address leaves CursorState.Offset unchanged from its previous value (Evidence: PageMemActionGotoAddress only sets Offset on success at line 139; observed)
3. Insufficient evidence: No test verifies cursor state preservation after invalid goto

Recommended Investigation:
Run the extended TestInvalidGotoReportsError test in test_integration.c that verifies cursor address and offset remain unchanged after invalid goto

Additional Evidence:
1. Please revise the fix to avoid mutating and then restoring cursor state. Calculate the aligned target address in a local variable, validate the full page range first, and only update CursorState.Address and CursorState.Offset after validation succeeds. Extend the existing TestInvalidGotoReportsError: first Goto to valid address 0x1080, record the cursor address and offset, reset the mock error count immediately before attempting invalid address 0x9000, then assert the invalid status, that an error was reported, and that both cursor fields remain unchanged. Run the host integration tests and report the results. Do not claim QEMU reproduction or validation.

Proposed Changes
--------------------------------------------------------------------------------
--- a/UefiNexusPkg/UI/Pages/PageMem/PageMemActions.c
+++ b/UefiNexusPkg/UI/Pages/PageMem/PageMemActions.c
@@ -153,6 +153,7 @@
     )
 {
     NX_U64 Address;
+    NX_U64 TargetAddress;
 
     if (PageState == NULL || Adapters == NULL) {
         return NX_UI_INVALID_PARAMETER;
@@ -165,9 +166,9 @@
     }
 
-    PageState->CursorState.Address = PageCoreAlignToPage(Address, PAGE_SIZE);
+    TargetAddress = PageCoreAlignToPage(Address, PAGE_SIZE);
 
-    if (!PageCoreIsRangeValid(&PageState->AddressMap, PageState->CursorState.Address, PAGE_SIZE)) {
+    if (!PageCoreIsRangeValid(&PageState->AddressMap, TargetAddress, PAGE_SIZE)) {
         ClearStatusLine(Adapters->Tui);
         Adapters->Tui->OutputStringAt(
             0,
@@ -178,7 +179,8 @@
         return NX_UI_INVALID_PARAMETER;
     }
 
-    PageState->CursorState.Offset = Address - PageState->CursorState.Address;
+    PageState->CursorState.Address = TargetAddress;
+    PageState->CursorState.Offset = Address - TargetAddress;
     PageCoreMarkForRedraw(PageState);
 
     return NX_UI_SUCCESS;
--------------------------------------------------------------------------------

Actions
- [A] Accept
- [R] Provide Feedback
- [Q] Quit
Choice: R
Additional evidence: The PageMemActions.c change looks correct, but the proposed diff is missing the regression test. Please also update the existing TestInvalidGotoReportsError in UefiNexusPkg/Tests/Core/test_integration.c: first Goto to 0x1080, save the cursor address and offset, reset the mock error count immediately before attempting 0x9000, then assert NX_UI_INVALID_PARAMETER, that an error was reported, and that both cursor fields are unchanged. Include this test change in the proposed diff. After acceptance, run the host integration tests and report the actual result. Do not claim QEMU validation.

================================================================================
Investigation Result
================================================================================
Investigation Summary

Confidence: 95%

Evidence Summary:
PageMemActionGotoAddress mutates CursorState.Address before validation (line 127 in PageMemActions.c), and only sets Offset on success (line 139). The existing TestInvalidGotoReportsError only checks error status and report, not cursor state preservation.

Hypotheses:
1. Invalid goto mutates CursorState.Address before validation, leaving it at the aligned invalid address when validation fails (Evidence: PageMemActionGotoAddress line 127 sets PageState->CursorState.Address = PageCoreAlignToPage(Address, PAGE_SIZE) before range check; observed)
2. Invalid goto leaves CursorState.Offset unchanged from its previous value (Evidence: PageMemActionGotoAddress only sets Offset on success at line 139; observed)
3. Insufficient evidence: No test verifies cursor state preservation after invalid goto

Recommended Investigation:
Run the extended TestInvalidGotoReportsError test in test_integration.c that verifies cursor address and offset remain unchanged after invalid goto

Additional Evidence:
1. Please revise the fix to avoid mutating and then restoring cursor state. Calculate the aligned target address in a local variable, validate the full page range first, and only update CursorState.Address and CursorState.Offset after validation succeeds. Extend the existing TestInvalidGotoReportsError: first Goto to valid address 0x1080, record the cursor address and offset, reset the mock error count immediately before attempting invalid address 0x9000, then assert the invalid status, that an error was reported, and that both cursor fields remain unchanged. Run the host integration tests and report the results. Do not claim QEMU reproduction or validation.
2. The PageMemActions.c change looks correct, but the proposed diff is missing the regression test. Please also update the existing TestInvalidGotoReportsError in UefiNexusPkg/Tests/Core/test_integration.c: first Goto to 0x1080, save the cursor address and offset, reset the mock error count immediately before attempting 0x9000, then assert NX_UI_INVALID_PARAMETER, that an error was reported, and that both cursor fields are unchanged. Include this test change in the proposed diff. After acceptance, run the host integration tests and report the actual result. Do not claim QEMU validation.

Proposed Changes
--------------------------------------------------------------------------------
--- a/UefiNexusPkg/UI/Pages/PageMem/PageMemActions.c
+++ b/UefiNexusPkg/UI/Pages/PageMem/PageMemActions.c
@@ -153,6 +153,7 @@
     )
 {
     NX_U64 Address;
+    NX_U64 TargetAddress;
 
     if (PageState == NULL || Adapters == NULL) {
         return NX_UI_INVALID_PARAMETER;
@@ -165,9 +166,9 @@
     }
 
-    PageState->CursorState.Address = PageCoreAlignToPage(Address, PAGE_SIZE);
+    TargetAddress = PageCoreAlignToPage(Address, PAGE_SIZE);
 
-    if (!PageCoreIsRangeValid(&PageState->AddressMap, PageState->CursorState.Address, PAGE_SIZE)) {
+    if (!PageCoreIsRangeValid(&PageState->AddressMap, TargetAddress, PAGE_SIZE)) {
         ClearStatusLine(Adapters->Tui);
         Adapters->Tui->OutputStringAt(
             0,
@@ -178,7 +179,8 @@
         return NX_UI_INVALID_PARAMETER;
     }
 
-    PageState->CursorState.Offset = Address - PageState->CursorState.Address;
+    PageState->CursorState.Address = TargetAddress;
+    PageState->CursorState.Offset = Address - TargetAddress;
     PageCoreMarkForRedraw(PageState);
 
     return NX_UI_SUCCESS;

--- a/UefiNexusPkg/Tests/Core/test_integration.c
+++ b/UefiNexusPkg/Tests/Core/test_integration.c
@@ -341,7 +341,7 @@
 }
 
 //
-// Validate invalid goto reports error.
+// Validate invalid goto reports error and preserves cursor state.
 //
 static
 NX_BOOL
@@ -350,12 +350,27 @@
     ADAPTER_MANAGER Adapters = MakeMockAdapters();
     PAGEMEM_PAGE_STATE State;
     NX_UI_KEY Key = { 0, L'g' };
+    NX_U64 OriginalAddress;
+    NX_UINTN OriginalOffset;
+
     PageMemControllerInit(&State, &Adapters);
+
+    // First goto to a valid address to set known cursor state
+    MockTuiSetNextReadHex(0x1080, NX_TRUE);
+    ASSERT_EQ(PageMemControllerHandleKeyPress(Key, &State, &Adapters), NX_UI_SUCCESS, "Valid goto status");
+    OriginalAddress = State.CursorState.Address;
+    OriginalOffset = State.CursorState.Offset;
+
+    // Reset mock error count before invalid goto attempt
+    MockErrorReset();
+
+    // Attempt invalid goto
     MockTuiSetNextReadHex(0x9000, NX_TRUE);
 
     ASSERT_EQ(PageMemControllerHandleKeyPress(Key, &State, &Adapters), NX_UI_INVALID_PARAMETER, "Invalid goto status");
     ASSERT_TRUE(MockErrorGetCount() > 0, "Invalid goto reports error");
+    ASSERT_EQ(State.CursorState.Address, OriginalAddress, "Cursor address unchanged after invalid goto");
+    ASSERT_EQ(State.CursorState.Offset, OriginalOffset, "Cursor offset unchanged after invalid goto");
 
     return NX_TRUE;
 }
--------------------------------------------------------------------------------

Actions
- [A] Accept
- [R] Provide Feedback
- [Q] Quit
Choice: A

Applied 2 change(s).
````

## Raw Fixture Git Status and Diff

This is the subsequent terminal output supplied for the same fixture, copied verbatim. The status reports the two changes as unstaged; no test output is included in this capture.

````c
brown@LAPTOP-ERMV6V13:~/RootPilot/examples/uefinexus/repo$ git status
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   UefiNexusPkg/Tests/Core/test_integration.c
        modified:   UefiNexusPkg/UI/Pages/PageMem/PageMemActions.c

no changes added to commit (use "git add" and/or "git commit -a")
brown@LAPTOP-ERMV6V13:~/RootPilot/examples/uefinexus/repo$ git diff
diff --git a/UefiNexusPkg/Tests/Core/test_integration.c b/UefiNexusPkg/Tests/Core/test_integration.c
index abf2230..3ce0a4d 100644
--- a/UefiNexusPkg/Tests/Core/test_integration.c
+++ b/UefiNexusPkg/Tests/Core/test_integration.c
@@ -341,7 +341,7 @@ TestGotoFlow(void)
 }
 
 //
-// Validate invalid goto reports error.
+// Validate invalid goto reports error and preserves cursor state.
 //
 static
 NX_BOOL
@@ -350,12 +350,27 @@ TestInvalidGotoReportsError(void)
     ADAPTER_MANAGER Adapters = MakeMockAdapters();
     PAGEMEM_PAGE_STATE State;
     NX_UI_KEY Key = { 0, L'g' };
+    NX_U64 OriginalAddress;
+    NX_UINTN OriginalOffset;
 
     PageMemControllerInit(&State, &Adapters);
+
+    // First goto to a valid address to set known cursor state
+    MockTuiSetNextReadHex(0x1080, NX_TRUE);
+    ASSERT_EQ(PageMemControllerHandleKeyPress(Key, &State, &Adapters), NX_UI_SUCCESS, "Valid goto status");
+    OriginalAddress = State.CursorState.Address;
+    OriginalOffset = State.CursorState.Offset;
+
+    // Reset mock error count before invalid goto attempt
+    MockErrorReset();
+
+    // Attempt invalid goto
     MockTuiSetNextReadHex(0x9000, NX_TRUE);
 
     ASSERT_EQ(PageMemControllerHandleKeyPress(Key, &State, &Adapters), NX_UI_INVALID_PARAMETER, "Invalid goto status");
     ASSERT_TRUE(MockErrorGetCount() > 0, "Invalid goto reports error");
+    ASSERT_EQ(State.CursorState.Address, OriginalAddress, "Cursor address unchanged after invalid goto");
+    ASSERT_EQ(State.CursorState.Offset, OriginalOffset, "Cursor offset unchanged after invalid goto");
 
     return NX_TRUE;
 }
diff --git a/UefiNexusPkg/UI/Pages/PageMem/PageMemActions.c b/UefiNexusPkg/UI/Pages/PageMem/PageMemActions.c
index d15d99c..b27dcb2 100644
--- a/UefiNexusPkg/UI/Pages/PageMem/PageMemActions.c
+++ b/UefiNexusPkg/UI/Pages/PageMem/PageMemActions.c
@@ -153,6 +153,7 @@ PageMemActionGotoAddress(
     )
 {
     NX_U64 Address;
+    NX_U64 TargetAddress;
 
     if (PageState == NULL || Adapters == NULL) {
         return NX_UI_INVALID_PARAMETER;
@@ -165,9 +166,9 @@ PageMemActionGotoAddress(
     }
 
-    PageState->CursorState.Address = PageCoreAlignToPage(Address, PAGE_SIZE);
+    TargetAddress = PageCoreAlignToPage(Address, PAGE_SIZE);
 
-    if (!PageCoreIsRangeValid(&PageState->AddressMap, PageState->CursorState.Address, PAGE_SIZE)) {
+    if (!PageCoreIsRangeValid(&PageState->AddressMap, TargetAddress, PAGE_SIZE)) {
         ClearStatusLine(Adapters->Tui);
         Adapters->Tui->OutputStringAt(
             0,
@@ -178,7 +179,8 @@ PageMemActionGotoAddress(
         return NX_UI_INVALID_PARAMETER;
     }
 
-    PageState->CursorState.Offset = Address - PageState->CursorState.Address;
+    PageState->CursorState.Address = TargetAddress;
+    PageState->CursorState.Offset = Address - TargetAddress;
     PageCoreMarkForRedraw(PageState);
 
     return NX_UI_SUCCESS;
brown@LAPTOP-ERMV6V13:~/RootPilot/examples/uefinexus/repo$ 
````
