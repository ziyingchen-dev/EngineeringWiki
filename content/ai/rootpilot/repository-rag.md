---
title: "Repository RAG"
weight: 3
date: 2026-09-24T15:49:05+08:00
draft: false
---

<style>
.term {
  text-decoration: underline 3px #005A9C;
  text-underline-offset: 4px;
}
</style>

Engineering repositories are often too large for an LLM's context window.

<span class="term">Repository RAG</span> retrieves relevant repository evidence first, then passes it to the LLM.

> **Core idea:** Retrieve first, generate second.

> **Example scope:** Names, paths, scores, and line numbers below are simplified examples, not verified repository records.

---

## Why It Is Needed

Searching a whole repository for every investigation adds noise and token cost.

Repository RAG answers one question:

```text
Which repository evidence is relevant?
```

---

## How It Works

1. [Multi-Domain Expert Routing](multi-domain-expert-routing.md) selects the repositories or modules.
2. Repository RAG retrieves evidence from that scope: source code, configuration files, documentation, commit history, symbols, and dependencies.
3. [RootPilot](https://github.com/ziyingchen-dev/RootPilot) combines the evidence with logs, historical cases, human feedback, test results, and runtime observations, then sends it to the LLM.

Repository RAG retrieves evidence. RootPilot reasons from evidence.

---

## Tool Integration

Repository RAG uses existing code-search tools exposed as [MCP](https://modelcontextprotocol.io) servers. RootPilot calls them as tools, so the retriever can be replaced without changing the investigation flow.

| Tool | Retrieval | Deployment |
|---|---|---|
| [Claude Context](https://github.com/zilliztech/claude-context) | Hybrid BM25 + dense vector | Requires OpenAI API key and Zilliz Cloud token |
| [RagCode MCP](https://github.com/doITmagic/rag-code-mcp) | Semantic + hybrid search, doc search | Local |
| [ccrag](https://pypi.org/project/ccrag/) | tree-sitter chunking, dense embeddings | Local, no API key |
| [Codebase Expert](https://github.com/darit/codebase-expert) | AST chunking, FAISS + BM25 | Local |

Selection criteria:

- Returns file path and line range, so evidence is traceable.
- Runs locally when the source code must not leave the network.
- One index per repository, queried only within the routed scope.

> Tools are candidates. Retrieval quality on C/C++ and JSON configuration files is not yet validated.

---

## Example

Issue:

```text
TMP75 temperature sensor reports no reading.
```

Routing result:

```text
0.78  entity-manager
0.15  dbus-sensors
0.07  phosphor-hwmon
```

Evidence retrieved from the selected scope:

```text
File:      entity-manager/configurations/example.json
Component: FruDevice
Interface: xyz.openbmc_project.Inventory.Item
```

RootPilot uses this evidence during investigation.

---

## Central Principle

```text
Issue
    ↓
RootPilot
    ├─ Routing RAG
    ├─ Multi-Domain Expert Routing
    ├─ Repository RAG  ← MCP code-search tools
    ├─ Historical Memory
    ├─ Human Feedback
    └─ LLM Reasoning
    ↓
Investigation Findings
```

> Repository RAG retrieves evidence.
> RootPilot orchestrates investigation capabilities to reduce debugging uncertainty.

For the implementation design, see [Repository RAG Implementation](../repository-rag-implementation.md).