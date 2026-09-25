---
title: "Routing RAG"
weight: 1
date: 2026-09-29T09:00:00+08:00
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
.reference-box mark {
     background:#FFF9C4;
     color:#17202A;
     padding:0 .25em;
     border-radius:3px
}
</style>

<span class="term-blue">Routing RAG</span> stores repository- and module-level metadata. [Multi-Domain Expert Routing](../multi-domain-expert-routing/) uses it to decide which repositories, subsystems, or modules are most likely related to an issue, before [Repository RAG](../repository-rag/) searches source code.

> **Core idea:** Build the map first, route second, retrieve third.

> **Example scope:** The record below is a simplified example, not a verified repository record.

---

## Why It Is Needed

Without Routing RAG, routing has to search an entire project, possibly hundreds of repositories or modules. This adds retrieval noise, token cost, and investigation time.

Routing RAG provides three kinds of context:

- Architecture
- Ownership
- Repository metadata

---

## Building Routing RAG

README files alone are often insufficient for routing. Critical ownership information is spread across:

- README files
- Architecture and design documents
- Service and interface definitions
- Dependency relationships
- Historical investigation records

[RootPilot](https://github.com/ziyingchen-dev/RootPilot) therefore builds structured metadata instead of relying on raw documentation.

```text
Project Knowledge
      ↓
Routing RAG
```

Example record:

```json
{
  "repository": "openbmc/entity-manager",
  "responsibilities": ["hardware configuration", "device detection", "inventory publishing"],
  "exposes": ["xyz.openbmc_project.Inventory.Item"],
  "related": ["openbmc/dbus-sensors"]
}
```

---

## Related Work

Hierarchical natural-language summaries of repositories have been used to route issues to the right repository before file-level search, shown on a 46-repository industrial Java system ([Oskooei et al., 2025](https://arxiv.org/abs/2512.05908)).

Routing RAG aims to add ownership, interface, dependency, and historical-investigation metadata, and targets embedded firmware ecosystems such as OpenBMC.

---

## Open Question

How to construct this metadata is still open. Different projects need different routing strategies, so RootPilot must study repositories, modules, ownership boundaries, subsystem relationships, and architecture dependencies to decide which metadata helps routing.

> The goal is to find common routing signals that can be standardized, while allowing project-specific customization.