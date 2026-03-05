# DEFINE: Invoice Processing Pipeline

> Serverless pipeline to extract structured data from delivery platform invoices using Gemini 2.5 Flash

## Metadata

| Attribute | Value |
|-----------|-------|
| **Feature** | INVOICE_PIPELINE |
| **Date** | 2026-01-29 |
| **Author** | define-agent |
| **Status** | ✅ Shipped |
| **Clarity Score** | 15/15 |
| **Source** | BRAINSTORM_INVOICE_PIPELINE.md |

---

## Problem Statement

The Finance team spends 80% of their time on manual data entry from delivery platform invoices (UberEats, DoorDash, Grubhub, iFood, Rappi), causing R$45,000+ in reconciliation errors quarterly. This manual process is error-prone, slow, and cannot scale with growing invoice volumes (2,000+/month, projected to 3,500 by year end).

---

## Target Users

| User | Role | Pain Point |
|------|------|------------|
| Finance Team | Invoice processing, reconciliation | 80% of time spent on manual data entry; high error rate |
| Operations Team | Restaurant partner management | R$45,000+ quarterly losses from reconciliation errors |
| Data Engineering | Pipeline maintenance | No automated extraction system exists |

---

## Goals

What success looks like (prioritized):

| Priority | Goal |
|----------|------|
| **MUST** | Extract invoice data from TIFF files with ≥90% accuracy per field |
| **MUST** | Process invoices end-to-end in <30 seconds (P95) |
| **MUST** | Support all 5 vendors: UberEats, DoorDash, Grubhub, iFood, Rappi |
| **MUST** | Write extracted data to BigQuery with Pydantic validation |
| **SHOULD** | Achieve pipeline availability >99% |
| **SHOULD** | Keep cost per invoice <$0.01 |
| **COULD** | Archive original invoices for compliance (7-year retention) |

---

## Success Criteria

Measurable outcomes (must include numbers):

- [ ] **Accuracy**: Extract invoice fields with ≥90% accuracy (measured against ground truth)
- [ ] **Latency**: Process 95% of invoices in <30 seconds end-to-end
- [ ] **Vendor Coverage**: Successfully extract from all 5 vendor invoice formats
- [ ] **Availability**: Pipeline uptime >99% during business hours
- [ ] **Cost**: Average cost per invoice extraction <$0.01
- [ ] **Volume**: Handle 2,000+ invoices per month without degradation
- [ ] **Validation**: <5% Pydantic validation failure rate

---

## Acceptance Tests

| ID | Scenario | Given | When | Then |
|----|----------|-------|------|------|
| AT-001 | Happy path - UberEats invoice | A valid UberEats TIFF in gs://input | File upload triggers pipeline | Invoice data appears in BigQuery within 30s |
| AT-002 | Multi-page TIFF | A 2-page invoice TIFF | Pipeline processes file | Both pages converted to PNG, all data extracted |
| AT-003 | All vendors | One invoice per vendor (5 total) | Pipeline processes all | All 5 vendor types extracted correctly |
| AT-004 | Invalid invoice | A corrupted or unreadable TIFF | Pipeline attempts extraction | File moved to gs://failed, error logged |
| AT-005 | Pydantic validation | Extracted data missing required field | Validation runs | Extraction rejected, error recorded in metrics |
| AT-006 | Duplicate detection | Same invoice submitted twice | Second submission processed | Deduplication prevents duplicate BigQuery entry |
| AT-007 | High volume | 100 invoices submitted within 1 hour | Pipeline scales | All processed within P95 latency target |

---

## Out of Scope

Explicitly NOT included in this feature:

- **OpenRouter fallback** - Gemini 2.5 Flash only for MVP (add if reliability issues)
- **Production environment** - Dev environment only until validation complete
- **CrewAI autonomous monitoring** - Deferred to Phase 2
- **Terraform/Terragrunt IaC** - Manual gcloud deployment for MVP
- **Real-time dashboards** - BigQuery queries available, no custom UI
- **PDF support** - TIFF only for MVP (PDF can be added later)
- **Handwritten invoice support** - Focus on printed/digital invoices

---

## Constraints

| Type | Constraint | Impact |
|------|------------|--------|
| **Cloud** | GCP only (Vertex AI, Cloud Run, GCS, Pub/Sub, BigQuery) | No multi-cloud portability needed for MVP |
| **Environment** | Dev environment only | No prod deployment until accuracy validated |
| **LLM** | Gemini 2.5 Flash via Vertex AI | Single model, no fallback chain |
| **Timeline** | April 1, 2026 production target | MVP must be validated before Q2 |
| **Budget** | ~$55/month estimated for prod volume | Cost per invoice must stay <$0.01 |
| **Data** | Sample data available (15 TIFFs, 5 vendors) | Testing scope defined by available samples |

---

## Technical Context

> Essential context for Design phase - prevents misplaced files and missed infrastructure needs.

| Aspect | Value | Notes |
|--------|-------|-------|
| **Deployment Location** | `src/functions/` + `src/shared/` | Monorepo with shared library |
| **KB Domains** | pydantic, gcp, gemini, openrouter | Validation patterns, Cloud Run, Vertex AI, Fallback LLM |
| **IaC Impact** | Manual gcloud for MVP | Terraform modules designed later |

### Code Structure (Approved)

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
│   ├── tiff_to_png/       # Function 1: Image conversion
│   ├── invoice_classifier/ # Function 2: Vendor detection
│   ├── data_extractor/    # Function 3: LLM extraction
│   └── bigquery_writer/   # Function 4: Data persistence
│
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/          # Sample data for tests
```

### Infrastructure (GCP Dev)

| Resource | Name | Purpose |
|----------|------|---------|
| Cloud Run | tiff-to-png-converter | TIFF → PNG conversion |
| Cloud Run | invoice-classifier | Vendor detection |
| Cloud Run | data-extractor | Gemini 2.5 Flash extraction |
| Cloud Run | bigquery-writer | BigQuery persistence |
| Pub/Sub | invoice-uploaded | GCS trigger |
| Pub/Sub | invoice-converted | Post-conversion |
| Pub/Sub | invoice-classified | Post-classification |
| Pub/Sub | invoice-extracted | Post-extraction |
| GCS | invoices-input | Raw TIFF landing |
| GCS | invoices-processed | Converted PNGs |
| GCS | invoices-archive | Compliance archive |
| GCS | invoices-failed | Error review |
| BigQuery | invoices.extracted_invoices | Main data |
| BigQuery | invoices.line_items | Line item details |

---

## Assumptions

Assumptions that if wrong could invalidate the design:

| ID | Assumption | If Wrong, Impact | Validated? |
|----|------------|------------------|------------|
| A-001 | Gemini 2.5 Flash achieves ≥90% accuracy on sample invoices | Would need fallback LLM or prompt iteration | [ ] |
| A-002 | Invoice volume stays under 3,500/month in 2026 | Would need autoscaling review | [x] |
| A-003 | All invoices are 1-2 pages | Would need multi-page batch handling | [x] |
| A-004 | GCP dev project has required APIs enabled | Would delay deployment | [ ] |
| A-005 | Sample data (15 TIFFs) is representative of production | Would need more samples for edge cases | [ ] |
| A-006 | Vertex AI quota sufficient for volume | Would need quota increase request | [ ] |

---

## Implementation Approach

**Selected: Function-by-Function** (user confirmed in brainstorm)

Build each function completely with all 5 vendor support before moving to the next:

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
└── Accuracy validation against ground truth
```

---

## Sample Data Inventory

| Type | Location | Count | Notes |
|------|----------|-------|-------|
| Input TIFFs | `data/input/` | 15 | 5 vendors × 3 invoices each |
| Processed PNGs | `data/processed/` | 30 | 2 pages per invoice |
| Ground Truth | `data/output/` | 15 | JSON with extracted data + metadata |
| Error Cases | `data/errors/` | 15 | Validation failures with business rule codes |

**Vendors represented:**
- UberEats (3 invoices)
- DoorDash (3 invoices)
- Grubhub (3 invoices)
- iFood (3 invoices)
- Rappi (3 invoices)

---

## Clarity Score Breakdown

| Element | Score (0-3) | Notes |
|---------|-------------|-------|
| Problem | 3 | Clear business impact with numbers (80% time, R$45K errors) |
| Users | 3 | Three personas with specific pain points |
| Goals | 3 | All goals measurable with MoSCoW prioritization |
| Success | 3 | Seven testable criteria with specific metrics |
| Scope | 3 | Eight items explicitly out of scope |
| **Total** | **15/15** | Exceeds minimum (12/15) |

---

## Open Questions

None - ready for Design.

All key questions were resolved in the BRAINSTORM phase:
- Build order: Function-by-function ✅
- Code structure: Monorepo with shared lib ✅
- Adapters: Full Protocol interfaces ✅
- Testing: Deploy to dev immediately ✅
- Vendors: All 5 from day 1 ✅

---

## Dependencies

| Dependency | Status | Owner | Notes |
|------------|--------|-------|-------|
| GCP dev project | Required | DevOps | invoice-pipeline-dev |
| Vertex AI API | Required | DevOps | Enable Gemini 2.5 Flash |
| Sample data | Available | Data Team | 15 TIFFs in data/input/ |
| Ground truth | Available | Data Team | 15 JSONs in data/output/ |
| Service accounts | Required | DevOps | 4 accounts for least-privilege |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | define-agent | Initial version from BRAINSTORM |
| 1.1 | 2026-01-29 | iterate-agent | Removed LangFuse/LLMOps from scope; Cloud Logging for observability |

---

## Next Step

**Ready for:** `/design .claude/sdd/features/DEFINE_INVOICE_PIPELINE.md`

---

## Quick Reference

```text
FEATURE: Invoice Processing Pipeline
CLARITY: 15/15 ✅

PROBLEM: 80% manual time, R$45K errors quarterly

MUST HAVE:
  - ≥90% extraction accuracy
  - <30s P95 latency
  - 5 vendors (UberEats, DoorDash, Grubhub, iFood, Rappi)
  - BigQuery persistence with Pydantic validation

OUT OF SCOPE:
  - OpenRouter fallback
  - LangFuse observability
  - Production environment
  - CrewAI monitoring
  - Terraform IaC

APPROACH: Function-by-function (complete each before moving on)

NEXT: /design
```
