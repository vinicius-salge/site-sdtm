# DEFINE: GCP Pipeline Deployment

> Deploy complete invoice extraction pipeline to GCP with 4 Cloud Run functions, event-driven architecture, and end-to-end validation

## Metadata

| Attribute | Value |
|-----------|-------|
| **Feature** | GCP_PIPELINE_DEPLOYMENT |
| **Date** | 2026-01-29 |
| **Author** | define-agent |
| **Status** | Ready for Design |
| **Clarity Score** | 15/15 |
| **Source** | BRAINSTORM_GCP_PIPELINE_DEPLOYMENT.md |

---

## Problem Statement

The team needs a working GCP infrastructure with functional Cloud Run services to develop, test, and validate the AI-powered invoice extraction pipeline. Currently, no infrastructure exists and no function code has been written, blocking all development and testing activities. The April 1, 2026 production deadline requires rapid deployment of a complete dev environment.

---

## Target Users

| User | Role | Pain Point |
|------|------|------------|
| Data Engineer | Pipeline developer | No infrastructure to deploy and test data flows |
| ML Engineer | Gemini prompt developer | No extraction function to test and iterate on prompts |
| QA Engineer | Validation specialist | No end-to-end flow to run acceptance tests |
| DevOps | Infrastructure manager | No baseline infrastructure to evolve into production |

---

## Goals

| Priority | Goal |
|----------|------|
| **MUST** | Deploy all 7 GCS buckets with proper lifecycle policies |
| **MUST** | Create Pub/Sub topic chain (5 topics + 5 DLQs) with event flow |
| **MUST** | Provision BigQuery dataset with 3 tables (extractions, line_items, logs) |
| **MUST** | Implement and deploy 4 Cloud Run functions with proper IAM |
| **MUST** | Establish working event chain: GCS → Pub/Sub → Cloud Run → BigQuery |
| **MUST** | Validate end-to-end flow with synthetic TIFF invoices |
| **SHOULD** | Document all deployment commands in executable scripts |
| **SHOULD** | Provide cleanup/teardown commands for resource management |
| **COULD** | Include health check and monitoring commands |

---

## Success Criteria

Measurable outcomes for deployment completion:

### Infrastructure (SC-INF)
- [ ] **SC-INF-01**: 7 GCS buckets created with naming `eda-gemini-dev-{purpose}`
- [ ] **SC-INF-02**: Lifecycle policies applied (30-day landing, 90-day processed, 7-year archive)
- [ ] **SC-INF-03**: 10 Pub/Sub topics created (5 main + 5 DLQ) with 7-day retention
- [ ] **SC-INF-04**: 6 Pub/Sub subscriptions created with proper ack deadlines
- [ ] **SC-INF-05**: BigQuery dataset `ds_bq_gemini_dev` created in US location
- [ ] **SC-INF-06**: 3 BigQuery tables created with correct schemas and partitioning
- [ ] **SC-INF-07**: 5 secrets stored in Secret Manager (even if placeholder values)
- [ ] **SC-INF-08**: 5 service accounts created with least-privilege IAM bindings

### Functions (SC-FNC)
- [ ] **SC-FNC-01**: `fnc-tiff-converter-dev` deployed and responding to health checks
- [ ] **SC-FNC-02**: `fnc-invoice-classifier-dev` deployed and responding to health checks
- [ ] **SC-FNC-03**: `fnc-data-extractor-dev` deployed and responding to health checks
- [ ] **SC-FNC-04**: `fnc-bigquery-writer-dev` deployed and responding to health checks
- [ ] **SC-FNC-05**: All functions have correct environment variables and secret bindings

### Event Chain (SC-EVT)
- [ ] **SC-EVT-01**: GCS upload to landing bucket triggers Pub/Sub notification
- [ ] **SC-EVT-02**: Pub/Sub push subscriptions invoke correct Cloud Run functions
- [ ] **SC-EVT-03**: Functions publish to next topic in chain
- [ ] **SC-EVT-04**: Failed messages route to DLQ topics

### End-to-End (SC-E2E)
- [ ] **SC-E2E-01**: Upload TIFF to landing bucket completes without error
- [ ] **SC-E2E-02**: PNG files appear in converted bucket within 60 seconds
- [ ] **SC-E2E-03**: Classified files appear in classified bucket within 30 seconds
- [ ] **SC-E2E-04**: Extraction JSON appears in extracted bucket within 120 seconds
- [ ] **SC-E2E-05**: Invoice data appears in BigQuery within 30 seconds of extraction
- [ ] **SC-E2E-06**: At least 1 of 10 synthetic TIFFs processes end-to-end successfully

---

## Acceptance Tests

### Infrastructure Tests

| ID | Scenario | Given | When | Then |
|----|----------|-------|------|------|
| AT-INF-01 | Bucket creation | Fresh GCP project | Deploy bucket commands | 7 buckets exist with correct names |
| AT-INF-02 | Topic creation | Buckets deployed | Deploy Pub/Sub commands | 10 topics exist with 7-day retention |
| AT-INF-03 | BigQuery setup | Topics deployed | Deploy BigQuery commands | Dataset and 3 tables exist |
| AT-INF-04 | IAM configuration | All infrastructure ready | Deploy IAM commands | Service accounts have correct permissions |

### Function Tests

| ID | Scenario | Given | When | Then |
|----|----------|-------|------|------|
| AT-FNC-01 | Converter health | Function deployed | Send health check request | Returns 200 OK |
| AT-FNC-02 | Classifier health | Function deployed | Send health check request | Returns 200 OK |
| AT-FNC-03 | Extractor health | Function deployed | Send health check request | Returns 200 OK |
| AT-FNC-04 | Writer health | Function deployed | Send health check request | Returns 200 OK |

### Event Chain Tests

| ID | Scenario | Given | When | Then |
|----|----------|-------|------|------|
| AT-EVT-01 | GCS trigger | Infrastructure deployed | Upload file to landing bucket | Message appears in uploaded topic |
| AT-EVT-02 | Converter trigger | Converter deployed | Message in uploaded topic | Converter function invoked |
| AT-EVT-03 | Classifier trigger | Classifier deployed | Message in converted topic | Classifier function invoked |
| AT-EVT-04 | Extractor trigger | Extractor deployed | Message in classified topic | Extractor function invoked |
| AT-EVT-05 | Writer trigger | Writer deployed | Message in extracted topic | Writer function invoked |

### End-to-End Tests

| ID | Scenario | Given | When | Then |
|----|----------|-------|------|------|
| AT-E2E-01 | Happy path | Full pipeline deployed | Upload `ubereats_INV-UE-308774_20260124.tiff` | Invoice data in BigQuery within 5 minutes |
| AT-E2E-02 | Multi-vendor | Full pipeline deployed | Upload all 10 synthetic TIFFs | At least 8 process successfully |
| AT-E2E-03 | Error handling | Full pipeline deployed | Upload invalid file | File moves to failed bucket |

---

## Out of Scope

Explicitly NOT included in this deployment:

| Item | Reason | Future Phase |
|------|--------|--------------|
| LangFuse observability | No API keys available | Phase 2 |
| OpenRouter fallback LLM | No API keys available | Phase 2 |
| Terraform/Terragrunt IaC | Adds complexity for initial deploy | Phase 3 |
| CI/CD pipeline automation | Out of scope for manual deployment | Phase 3 |
| CrewAI autonomous monitoring | Phase 2 feature per requirements | Phase 2 |
| Production environment | Dev environment first | Phase 4 |
| Load testing | Performance optimization later | Phase 3 |
| Multi-region deployment | Single region (us-central1) for dev | Phase 4 |
| Custom domains | Not needed for dev | Phase 4 |
| VPC configuration | Default VPC sufficient for dev | Phase 3 |

---

## Constraints

| Type | Constraint | Impact |
|------|------------|--------|
| **Technical** | Gemini-only LLM (no fallback) | Extraction function simpler but less resilient |
| **Technical** | No existing function code | Must write all 4 functions from scratch |
| **Technical** | gcloud CLI only (no Terraform) | Manual deployment, harder to reproduce |
| **Environment** | Dev environment only | `invoice-pipeline-dev` project |
| **Region** | us-central1 only | All resources in single region |
| **Timeline** | April 1, 2026 production deadline | Must complete dev deployment quickly |
| **Budget** | Estimated ~$20/month for dev | Resource limits: max 10 instances per function |

---

## Assumptions

| ID | Assumption | If Wrong, Impact | Validated? |
|----|------------|------------------|------------|
| A-001 | GCP project `invoice-pipeline-dev` exists with billing enabled | Cannot deploy any resources | [ ] |
| A-002 | User has Owner or Editor role on the project | IAM commands will fail | [ ] |
| A-003 | Vertex AI API is enabled with Gemini 2.0 Flash access | Extraction function will fail | [ ] |
| A-004 | gcloud CLI is installed and authenticated | All commands will fail | [ ] |
| A-005 | Docker is installed for building Cloud Run images | Cannot deploy functions | [ ] |
| A-006 | Synthetic TIFFs are valid multi-page TIFF format | Converter function may fail | [x] |
| A-007 | Gemini API key is available for Secret Manager | Extraction won't authenticate | [ ] |
| A-008 | Network allows outbound HTTPS to Vertex AI | LLM calls will timeout | [ ] |

---

## Functional Requirements

### FR-100: GCS Bucket Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-101 | Create 7 GCS buckets with naming convention `eda-gemini-dev-{purpose}` | MUST |
| FR-102 | Apply uniform bucket-level access to all buckets | MUST |
| FR-103 | Enable public access prevention on all buckets | MUST |
| FR-104 | Configure lifecycle policy: 30-day retention for landing bucket | SHOULD |
| FR-105 | Configure lifecycle policy: 90-day retention for processed buckets | SHOULD |
| FR-106 | Configure lifecycle policy: 7-year tiered storage for archive bucket | SHOULD |

### FR-200: Pub/Sub Configuration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-201 | Create 5 main topics for pipeline stages (uploaded, converted, classified, extracted, loaded) | MUST |
| FR-202 | Create 5 DLQ topics for error handling | MUST |
| FR-203 | Configure 7-day message retention on main topics | MUST |
| FR-204 | Configure 14-day message retention on DLQ topics | SHOULD |
| FR-205 | Create push subscriptions to Cloud Run functions | MUST |
| FR-206 | Configure appropriate ack deadlines per function (120-540 seconds) | MUST |
| FR-207 | Configure max delivery attempts (3-5) before DLQ | SHOULD |

### FR-300: BigQuery Setup

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-301 | Create dataset `ds_bq_gemini_dev` in US location | MUST |
| FR-302 | Create `tb_extractions` table with 17-column schema | MUST |
| FR-303 | Create `tb_line_items` table with 9-column schema | MUST |
| FR-304 | Create `tb_extraction_logs` table with 9-column schema | SHOULD |
| FR-305 | Configure time partitioning on `processed_at` for extractions | SHOULD |
| FR-306 | Configure clustering on `vendor_type, invoice_date` for extractions | SHOULD |

### FR-400: Secret Manager

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-401 | Create `gemini-api-key` secret with actual API key | MUST |
| FR-402 | Create `langfuse-public-key` secret (placeholder OK) | SHOULD |
| FR-403 | Create `langfuse-secret-key` secret (placeholder OK) | SHOULD |
| FR-404 | Create `openrouter-api-key` secret (placeholder OK) | SHOULD |
| FR-405 | Create `slack-webhook-url` secret (placeholder OK) | COULD |

### FR-500: Service Accounts & IAM

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-501 | Create 5 service accounts with naming `sa-{function}-dev` | MUST |
| FR-502 | Grant Storage Object Viewer/Creator on appropriate buckets | MUST |
| FR-503 | Grant Pub/Sub Publisher on downstream topics | MUST |
| FR-504 | Grant Vertex AI User to data-extractor service account | MUST |
| FR-505 | Grant Secret Manager Accessor to data-extractor service account | MUST |
| FR-506 | Grant BigQuery Data Editor to bigquery-writer service account | MUST |

### FR-600: Cloud Run Functions

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-601 | Implement TIFF Converter function (TIFF → PNG with Pillow) | MUST |
| FR-602 | Implement Invoice Classifier function (vendor type detection) | MUST |
| FR-603 | Implement Data Extractor function (Gemini extraction with Pydantic) | MUST |
| FR-604 | Implement BigQuery Writer function (schema validation and insert) | MUST |
| FR-605 | Configure memory/CPU per function spec (512Mi-2Gi, 1-2 CPU) | MUST |
| FR-606 | Configure timeouts per function spec (120-540 seconds) | MUST |
| FR-607 | Configure max instances (5-10 per function) | SHOULD |
| FR-608 | Set ingress to internal-only | MUST |
| FR-609 | Disable unauthenticated access | MUST |

### FR-700: Event Chain

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-701 | Configure GCS notification to Pub/Sub on landing bucket | MUST |
| FR-702 | Filter notifications to `invoices/` prefix only | MUST |
| FR-703 | Filter notifications to OBJECT_FINALIZE events only | MUST |
| FR-704 | Create push subscriptions linking topics to functions | MUST |

### FR-800: Validation & Testing

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-801 | Provide verification commands for each infrastructure component | MUST |
| FR-802 | Provide end-to-end test procedure using synthetic TIFFs | MUST |
| FR-803 | Provide log monitoring commands | SHOULD |
| FR-804 | Provide BigQuery query to verify extracted data | MUST |

### FR-900: Cleanup

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-901 | Provide cleanup commands to delete all Cloud Run services | MUST |
| FR-902 | Provide cleanup commands to delete all Pub/Sub resources | MUST |
| FR-903 | Provide cleanup commands to delete all GCS buckets and contents | MUST |
| FR-904 | Provide cleanup commands to delete BigQuery dataset | MUST |
| FR-905 | Provide cleanup commands to delete secrets | SHOULD |
| FR-906 | Provide cleanup commands to delete service accounts | SHOULD |

---

## Non-Functional Requirements

| ID | Requirement | Target | Priority |
|----|-------------|--------|----------|
| NFR-001 | End-to-end processing time for single invoice | < 5 minutes | SHOULD |
| NFR-002 | Function cold start time | < 30 seconds | SHOULD |
| NFR-003 | Extraction accuracy on synthetic invoices | > 80% fields correct | SHOULD |
| NFR-004 | Monthly cost for dev environment | < $50 | SHOULD |
| NFR-005 | Deployment script execution time | < 30 minutes | COULD |

---

## Clarity Score Breakdown

| Element | Score (0-3) | Notes |
|---------|-------------|-------|
| Problem | 3 | Clear: need working pipeline infrastructure for dev/test |
| Users | 3 | Four users identified with specific pain points |
| Goals | 3 | 9 goals with MoSCoW prioritization |
| Success | 3 | 20+ measurable success criteria with IDs |
| Scope | 3 | Explicit out-of-scope table with reasoning |
| **Total** | **15/15** | Ready for Design |

---

## Dependencies

| Dependency | Type | Required By | Status |
|------------|------|-------------|--------|
| GCP Project with billing | External | All resources | To verify |
| gcloud CLI authenticated | Tool | All commands | To verify |
| Docker installed | Tool | Function builds | To verify |
| Gemini API access | External | FR-603 | Available |
| Synthetic TIFF samples | Internal | FR-802 | Available |
| Pydantic schemas | Internal | FR-603, FR-604 | Available in gen/ |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Gemini API quota exceeded | Low | High | Monitor usage, implement retries |
| IAM permission errors | Medium | Medium | Test each permission individually |
| Docker build failures | Medium | Medium | Use standard Python base images |
| Event chain misconfiguration | Medium | High | Deploy and test incrementally |
| TIFF conversion failures | Low | Medium | Test with synthetic samples first |

---

## Open Questions

None - ready for Design.

All questions were answered during the BRAINSTORM phase:
- Deployment approach: Full Build selected
- Scope: Full Spec confirmed (no YAGNI simplifications)
- Secrets: Gemini only, others as placeholders
- Test data: Synthetic TIFFs available

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | define-agent | Initial version from BRAINSTORM |

---

## Next Step

**Ready for:** `/design .claude/sdd/features/DEFINE_GCP_PIPELINE_DEPLOYMENT.md`

This will create:
1. Technical architecture diagrams
2. Function implementation specifications
3. Deployment sequence and scripts
4. Testing procedures
