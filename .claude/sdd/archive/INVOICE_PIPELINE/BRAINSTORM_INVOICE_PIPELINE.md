# BRAINSTORM: Invoice Processing Pipeline

> Exploratory session to clarify intent and approach before requirements capture

## Metadata

| Attribute | Value |
|-----------|-------|
| **Feature** | INVOICE_PIPELINE |
| **Date** | 2026-01-29 |
| **Author** | brainstorm-agent |
| **Status** | ✅ Shipped |

---

## Initial Idea

**Raw Input:** Build the full invoice processing pipeline based on design/gcp-deployment-requirements.md

**Context Gathered:**
- Comprehensive deployment requirements document already exists (v1.1.0)
- 4 Cloud Run functions defined with specs
- Pydantic schema ready with 12 invoice fields
- Sample data available for all 5 vendors (15 TIFFs, 30 PNGs, 15 ground truth JSONs)
- Architecture decisions already confirmed (Gemini 2.5 Flash, dev-only, adapters)

**Technical Context Observed (for Define):**

| Aspect | Observation | Implication |
|--------|-------------|-------------|
| Likely Location | src/functions/ + src/shared/ | Monorepo with shared library |
| Relevant KB Domains | pydantic, gcp, gemini | Patterns to consult for validation and extraction |
| IaC Patterns | gcloud CLI commands documented | Manual deployment for MVP, Terraform later |

---

## Discovery Questions & Answers

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 1 | Build order? | Full pipeline end-to-end | Build all 4 functions together, integrate early |
| 2 | Sample data? | data/input/ (15 TIFFs, 5 vendors) | Excellent test coverage, discovered 2 new vendors |
| 3 | Code structure? | Monorepo with shared lib | src/shared/ for Pydantic models + adapters |
| 4 | Adapter pattern? | Full adapters | Protocol interfaces + GCP implementations |
| 5 | Testing approach? | Deploy to dev immediately | Need GCP infrastructure ready |

---

## Sample Data Inventory

> Samples improve LLM accuracy through in-context learning and few-shot prompting.

| Type | Location | Count | Notes |
|------|----------|-------|-------|
| Input TIFFs | `data/input/` | 15 | 5 vendors × 3 invoices each |
| Processed PNGs | `data/processed/` | 30 | 2 pages per invoice (multi-page) |
| Ground Truth | `data/output/` | 15 | JSON with extracted data + metadata |
| Error Cases | `data/errors/` | 15 | Validation failures with business rule codes |

**Vendors in sample data:**
- UberEats (3 invoices)
- DoorDash (3 invoices)
- Grubhub (3 invoices)
- iFood (3 invoices) - **NEW: not in original requirements**
- Rappi (3 invoices) - **NEW: not in original requirements**

**How samples will be used:**
- Few-shot examples in extraction prompts (ground truth JSONs)
- Test fixtures for unit and integration tests
- Validation reference for accuracy testing
- Error cases for testing validation logic

---

## Approaches Explored

### Approach A: Vertical Slice

**Description:** Build one complete vertical slice first (TIFF → BigQuery for UberEats only), then expand to other vendors.

**Pros:**
- Validates full pipeline early
- Catches integration issues immediately
- Delivers working value incrementally

**Cons:**
- Vendor-specific prompts added later
- May need to revisit code for multi-vendor support

---

### Approach B: Infrastructure-First

**Description:** Set up all GCP infrastructure (Terraform), then build functions.

**Pros:**
- Clean infrastructure from the start
- Clear separation of IaC vs code

**Cons:**
- Slower to see working pipeline
- Infrastructure changes may be needed as code evolves

---

### Approach C: Function-by-Function ⭐ Selected

**Description:** Build each function completely (all 5 vendors) before moving to the next.

**Pros:**
- Each function is complete before moving on
- Clear ownership and testing per function
- All vendors supported from the start

**Cons:**
- Integration issues found later
- Longer wait for end-to-end validation

**Why Selected:** User preference for systematic, complete implementation per component.

---

## Selected Approach

| Attribute | Value |
|-----------|-------|
| **Chosen** | Approach C: Function-by-Function |
| **User Confirmation** | 2026-01-29 |
| **Reasoning** | User prefers systematic approach with each function complete before moving on |

---

## Key Decisions Made

| # | Decision | Rationale | Alternative Rejected |
|---|----------|-----------|----------------------|
| 1 | Monorepo with shared library | Enables code reuse, consistent schemas | Separate repos per function |
| 2 | Full adapter pattern | Enables unit testing with mocks | Direct SDK calls |
| 3 | Deploy to dev immediately | Real cloud feedback | Local emulators |
| 4 | Function-by-function build | Complete each component | Vertical slice approach |
| 5 | Support all 5 vendors from day 1 | Sample data already has 5 | UberEats only for MVP |

---

## Features Removed (YAGNI)

| Feature Suggested | Reason Removed | Can Add Later? |
|-------------------|----------------|----------------|
| OpenRouter fallback | Start with Gemini only - add if reliability issues | Yes (Phase 2) |
| Production environment | Dev-only for MVP | Yes (post-validation) |
| CrewAI autonomous ops | Already deferred in requirements | Yes (Phase 2) |

---

## Incremental Validations

| Section | Presented | User Feedback | Adjusted? |
|---------|-----------|---------------|-----------|
| Code structure | ✅ | "Yes, looks good" | No |
| Implementation order | ✅ | "Yes, proceed" | No |

---

## Suggested Requirements for /define

Based on this brainstorm session, the following should be captured in the DEFINE phase:

### Problem Statement (Draft)

Build a serverless invoice processing pipeline that extracts structured data from TIFF invoices using Gemini 2.5 Flash, supporting 5 delivery platform vendors (UberEats, DoorDash, Grubhub, iFood, Rappi).

### Target Users (Draft)

| User | Pain Point |
|------|------------|
| Finance Team | 80% time spent on manual data entry from invoices |
| Operations Team | R$45,000+ quarterly reconciliation errors |

### Success Criteria (Draft)

- [ ] Extract invoice data with ≥90% accuracy per field
- [ ] Process invoices in <30 seconds (P95)
- [ ] Support all 5 vendors with vendor-specific prompts
- [ ] Pipeline availability >99%
- [ ] Cost per invoice <$0.01

### Constraints Identified

- GCP dev environment only (no prod for MVP)
- Gemini 2.5 Flash only (no OpenRouter fallback)
- Manual gcloud deployment (no Terraform for MVP)

### Out of Scope (Confirmed)

- OpenRouter fallback LLM
- Production environment
- CrewAI autonomous monitoring
- Terraform/Terragrunt infrastructure as code

---

## Proposed Code Structure

```text
src/
├── shared/
│   ├── __init__.py
│   ├── schemas/           # Pydantic models
│   │   ├── invoice.py     # Invoice, LineItem, VendorType
│   │   └── messages.py    # Pub/Sub message schemas
│   ├── adapters/          # Protocol + GCP implementations
│   │   ├── storage.py     # StorageAdapter + GCSAdapter
│   │   ├── messaging.py   # MessagingAdapter + PubSubAdapter
│   │   └── llm.py         # LLMAdapter + GeminiAdapter
│   └── utils/
│       ├── logging.py     # Structured JSON logging
│       └── config.py      # Environment configuration
│
├── functions/
│   ├── tiff_to_png/
│   │   ├── main.py
│   │   ├── converter.py
│   │   └── requirements.txt
│   ├── invoice_classifier/
│   │   ├── main.py
│   │   ├── classifier.py
│   │   └── requirements.txt
│   ├── data_extractor/
│   │   ├── main.py
│   │   ├── extractor.py
│   │   ├── prompts/
│   │   │   ├── ubereats.txt
│   │   │   ├── doordash.txt
│   │   │   ├── grubhub.txt
│   │   │   ├── ifood.txt
│   │   │   └── rappi.txt
│   │   └── requirements.txt
│   └── bigquery_writer/
│       ├── main.py
│       ├── writer.py
│       └── requirements.txt
│
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/
```

---

## Implementation Order

```text
Phase 1: tiff_to_png (all vendors)
├── Pillow TIFF→PNG conversion
├── Multi-page splitting
├── GCS read/write via adapters
└── Pub/Sub publishing

Phase 2: invoice_classifier (all vendors)
├── Image quality validation
├── Vendor detection (pattern matching)
├── Archive original to gs://archive
└── Pub/Sub with vendor_type

Phase 3: data_extractor (all vendors)
├── Gemini 2.5 Flash integration
├── 5 vendor-specific prompts
├── Pydantic validation
└── Error handling (→ gs://failed)

Phase 4: bigquery_writer
├── Pydantic re-validation
├── BigQuery write (invoices + line_items)
├── Metrics logging
└── Deduplication check

Phase 5: Integration & Deploy
├── Wire all functions via Pub/Sub
├── Deploy to GCP dev
├── End-to-end testing with sample data
└── Accuracy validation
```

---

## Session Summary

| Metric | Value |
|--------|-------|
| Questions Asked | 7 |
| Approaches Explored | 3 |
| Features Removed (YAGNI) | 4 |
| Validations Completed | 2 |
| Duration | ~15 minutes |

---

## Action Items

1. **Update requirements:** Add iFood and Rappi to vendor list (5 vendors, not 4)
2. **Update VendorType enum:** Add IFOOD and RAPPI values
3. **Create prompt templates:** 5 vendor-specific extraction prompts needed

---

## Next Step

**Ready for:** `/define .claude/sdd/features/BRAINSTORM_INVOICE_PIPELINE.md`
