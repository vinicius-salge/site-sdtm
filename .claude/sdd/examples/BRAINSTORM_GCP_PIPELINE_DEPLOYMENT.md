# BRAINSTORM: GCP Pipeline Deployment

> Exploratory session to clarify deployment approach for invoice extraction pipeline

## Metadata

| Attribute | Value |
|-----------|-------|
| **Feature** | GCP_PIPELINE_DEPLOYMENT |
| **Date** | 2026-01-29 |
| **Author** | brainstorm-agent |
| **Status** | Ready for Define |

---

## Initial Idea

**Raw Input:** Deploy invoice extraction pipeline to GCP using gcloud CLI based on design/gcp-deployment-requirements.md - 4 Cloud Run functions, Pub/Sub event chain, GCS folder flow, BigQuery tables, Secret Manager

**Context Gathered:**
- Comprehensive deployment spec exists at `design/gcp-deployment-requirements.md` (1032 lines)
- Synthetic invoice generator exists with 10 sample TIFFs for 5 vendors
- No Cloud Run function code exists yet - needs to be written
- User has Gemini/Vertex AI access but not LangFuse or OpenRouter keys yet
- Fresh GCP project `invoice-pipeline-dev` ready for deployment

---

## Discovery Questions & Answers

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 1 | What is your primary goal with this deployment? | Full Pipeline Test | Need all components deployed and validated end-to-end |
| 2 | What is the current state of your GCP project? | New Project | Clean slate - no conflicts or existing resources |
| 3 | What is the status of your Cloud Run function code? | No Code Yet | Must write all 4 functions as part of this effort |
| 4 | Do you have the required API keys ready? | Gemini Only | Core LLM available; LangFuse/OpenRouter deferred |
| 5 | Do you have sample invoices for testing? | Synthetic samples exist | 10 TIFFs ready at `gen/synthetic-invoice-gen/samples/` |

---

## Sample Data Inventory

| Type | Location | Count | Notes |
|------|----------|-------|-------|
| Input files (TIFF) | `gen/synthetic-invoice-gen/samples/` | 10 | UberEats, DoorDash, GrubHub, iFood, Rappi (2 each) |
| Invoice schemas | `gen/synthetic-invoice-gen/src/invoice_gen/schemas/` | 4 | Pydantic models for invoice, delivery, partner, payment |
| Ground truth | Embedded in TIFF filenames | 10 | Invoice IDs and dates in filename pattern |
| Related code | `gen/synthetic-invoice-gen/src/` | 17 files | Generator code with brand templates |

**How samples will be used:**
- End-to-end validation after deployment
- Ground truth for extraction accuracy testing
- Vendor-specific prompt development reference

---

## Approaches Explored

### Approach A: Phased Deployment with Stub Functions

**Description:** Deploy infrastructure first, then minimal pass-through functions to validate event chain

**Pros:**
- Validates infrastructure before complex code
- Identifies IAM/networking issues early
- Lower risk - fix problems in isolation

**Cons:**
- Requires building Docker images for stubs
- Two deployments instead of one
- Doesn't deliver business value immediately

---

### Approach B: Infrastructure-Only Deployment

**Description:** Deploy GCS, Pub/Sub, BigQuery, Secrets only - skip functions until code is ready

**Pros:**
- Fastest deployment
- No Docker images needed

**Cons:**
- Can't validate end-to-end flow
- Event triggers won't work
- Doesn't prove architecture works

---

### Approach C: Full Build ⭐ Selected

**Description:** Write all 4 Cloud Run functions, build Docker images, deploy complete infrastructure and functions together

**Pros:**
- Complete solution in one effort
- Fully functional pipeline
- Immediate business value

**Cons:**
- Higher complexity
- Debugging may be harder if issues arise
- Requires writing significant code

**Why Selected:** User confirmed preference for complete, production-ready deployment

---

## Selected Approach

| Attribute | Value |
|-----------|-------|
| **Chosen** | Approach C: Full Build |
| **User Confirmation** | 2026-01-29 |
| **Reasoning** | User wants full pipeline test with all components |

---

## Key Decisions Made

| # | Decision | Rationale | Alternative Rejected |
|---|----------|-----------|----------------------|
| 1 | Full Build (all 4 functions) | User wants complete solution | Phased approach with stubs |
| 2 | Full Spec (7 buckets, 5 secrets, 3 tables) | User rejected YAGNI simplifications | MVP with 4 buckets, 1 secret |
| 3 | gcloud CLI deployment | Manual control for learning | Terraform (too complex for initial deployment) |
| 4 | Dev environment first | Lower risk, easy teardown | Prod deployment |
| 5 | Gemini 2.0 Flash primary | User has access | OpenRouter fallback (no keys) |

---

## Features Removed (YAGNI)

| Feature Suggested | Reason Removed | Can Add Later? |
|-------------------|----------------|----------------|
| LangFuse integration | No API keys available | Yes |
| OpenRouter fallback | No API keys available | Yes |
| Terraform deployment | Adds complexity for initial deploy | Yes |
| CI/CD pipeline | Out of scope for manual deployment | Yes |
| CrewAI monitoring | Phase 2 feature | Yes |

**Note:** User rejected further YAGNI simplifications. Full spec will be deployed.

---

## Incremental Validations

| Section | Presented | User Feedback | Adjusted? |
|---------|-----------|---------------|-----------|
| Deployment goal | ✅ | Full Pipeline Test | No |
| GCP project state | ✅ | New Project | No |
| Code readiness | ✅ | No Code Yet | Required full build |
| Secrets status | ✅ | Gemini Only | LangFuse/OpenRouter deferred |
| Sample data | ✅ | Synthetic TIFFs available | No |
| Approach selection | ✅ | Chose Full Build | No |
| YAGNI scope | ✅ | Rejected simplifications | Full spec required |

---

## Suggested Requirements for /define

### Problem Statement (Draft)

Deploy a complete, production-ready invoice extraction pipeline to GCP using gcloud CLI commands, including 4 Cloud Run functions that process TIFF invoices through conversion, classification, extraction (via Gemini), and BigQuery loading.

### Target Users (Draft)

| User | Pain Point |
|------|------------|
| Data Engineer | Need working pipeline infrastructure to develop against |
| ML Engineer | Need extraction function to test Gemini prompts |
| QA | Need end-to-end flow to validate with sample invoices |

### Success Criteria (Draft)

- [ ] All 7 GCS buckets created with lifecycle policies
- [ ] All 5 Pub/Sub topics + 5 DLQs created
- [ ] BigQuery dataset with 3 tables created
- [ ] 5 service accounts with least-privilege IAM
- [ ] 4 Cloud Run functions deployed and running
- [ ] GCS → Pub/Sub → Cloud Run event chain working
- [ ] End-to-end test: upload TIFF → data in BigQuery
- [ ] Cleanup commands documented and tested

### Constraints Identified

- **No LangFuse/OpenRouter keys** - extraction function will use Gemini only
- **No existing function code** - must write all 4 functions
- **Dev environment** - `invoice-pipeline-dev` project
- **Manual deployment** - gcloud CLI, not Terraform

### Out of Scope (Confirmed)

- LangFuse observability integration
- OpenRouter fallback LLM
- Terraform/Terragrunt IaC
- CI/CD pipeline automation
- CrewAI autonomous monitoring
- Production environment deployment
- Load testing / performance optimization

---

## Component Inventory

### Infrastructure (gcloud CLI)

| Component | Count | Names |
|-----------|-------|-------|
| GCS Buckets | 7 | landing, converted, classified, extracted, loaded, failed, archive |
| Pub/Sub Topics | 10 | 5 main + 5 DLQ |
| Pub/Sub Subscriptions | 6 | 5 push + 1 monitoring |
| BigQuery Dataset | 1 | ds_bq_gemini_dev |
| BigQuery Tables | 3 | tb_extractions, tb_line_items, tb_extraction_logs |
| Secrets | 5 | gemini-api-key, langfuse-*, openrouter-*, slack-webhook |
| Service Accounts | 5 | tiff-converter, invoice-classifier, data-extractor, bigquery-writer, gcs-trigger |

### Cloud Run Functions (To Be Written)

| Function | Purpose | Trigger | Key Dependencies |
|----------|---------|---------|------------------|
| fnc-tiff-converter-dev | TIFF → PNG | Pub/Sub | Pillow, google-cloud-storage |
| fnc-invoice-classifier-dev | Detect vendor type | Pub/Sub | google-cloud-storage |
| fnc-data-extractor-dev | Gemini extraction | Pub/Sub | google-cloud-aiplatform, pydantic |
| fnc-bigquery-writer-dev | Write to BigQuery | Pub/Sub | google-cloud-bigquery |

---

## Session Summary

| Metric | Value |
|--------|-------|
| Questions Asked | 5 |
| Approaches Explored | 3 |
| Features Removed (YAGNI) | 5 (LangFuse, OpenRouter, Terraform, CI/CD, CrewAI) |
| Validations Completed | 7 |
| Duration | ~15 minutes |

---

## Next Step

**Ready for:** `/define .claude/sdd/features/BRAINSTORM_GCP_PIPELINE_DEPLOYMENT.md`

This will capture formal requirements for:
1. Infrastructure deployment scripts
2. Cloud Run function implementations
3. End-to-end validation procedures
4. Cleanup/teardown commands
