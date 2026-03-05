# DESIGN: Invoice Processing Pipeline

> Technical design for serverless invoice extraction using Gemini 2.5 Flash on GCP

## Metadata

| Attribute | Value |
|-----------|-------|
| **Feature** | INVOICE_PIPELINE |
| **Date** | 2026-01-29 |
| **Author** | design-agent |
| **DEFINE** | [DEFINE_INVOICE_PIPELINE.md](./DEFINE_INVOICE_PIPELINE.md) |
| **Status** | ✅ Shipped |

---

## Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                    INVOICE PROCESSING PIPELINE - ARCHITECTURE                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  INGESTION           PROCESSING                               STORAGE         │
│  ─────────           ──────────                               ───────         │
│                                                                               │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │
│  │  TIFF   │    │  TIFF→PNG   │    │  CLASSIFY   │    │  EXTRACT    │       │
│  │  (GCS)  │───▶│  CONVERTER  │───▶│   VENDOR    │───▶│  (GEMINI)   │       │
│  └─────────┘    └─────────────┘    └─────────────┘    └─────────────┘       │
│       │               │                  │                   │               │
│       │               ▼                  ▼                   ▼               │
│       │         ┌─────────┐        ┌─────────┐         ┌─────────┐         │
│       │         │processed│        │ archive │         │ failed  │         │
│       │         │  (GCS)  │        │  (GCS)  │         │  (GCS)  │         │
│       │         └─────────┘        └─────────┘         └─────────┘         │
│       │                                                      │               │
│       │                                                      ▼               │
│       │                                              ┌─────────────┐        │
│       │                                              │  BIGQUERY   │        │
│       │                                              │   WRITER    │        │
│       │                                              └─────────────┘        │
│       │                                                      │               │
│       │                                                      ▼               │
│       │                                              ┌─────────────┐        │
│       │                                              │  BigQuery   │        │
│       │                                              │   Tables    │        │
│       │                                              └─────────────┘        │
│       │                                                                      │
│       └──────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  EVENT BUS (Pub/Sub)                                                          │
│  ───────────────────                                                          │
│                                                                               │
│  invoice-uploaded ──▶ invoice-converted ──▶ invoice-classified ──▶ invoice-  │
│        │                     │                      │             extracted  │
│        ▼                     ▼                      ▼                  │     │
│  tiff-to-png           invoice-            data-                      ▼     │
│  -converter            classifier          extractor           bigquery-    │
│                                                                writer        │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| **tiff-to-png-converter** | Convert TIFF to PNG for LLM processing | Cloud Run + Pillow |
| **invoice-classifier** | Validate quality and detect vendor type | Cloud Run + Pattern matching |
| **data-extractor** | Extract structured data using LLM | Cloud Run + Vertex AI (Gemini 2.5 Flash) |
| **bigquery-writer** | Persist validated data to BigQuery | Cloud Run + BigQuery SDK |
| **GCS Buckets** | File storage for pipeline stages | Cloud Storage |
| **Pub/Sub Topics** | Event-driven messaging between functions | Cloud Pub/Sub |
| **BigQuery Tables** | Extracted invoice data warehouse | BigQuery |

---

## Key Decisions

### Decision 1: Reuse Existing Pydantic Models

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-01-29 |

**Context:** The codebase already has comprehensive Pydantic models in `src/invoice_extractor/models.py` including `ExtractedInvoice`, `LineItem`, `VendorType`, `ExtractionResult`, and `ValidationResult`. These models have validators, computed fields, and business rule checks.

**Choice:** Refactor existing models into `src/shared/schemas/` for use across all 4 Cloud Run functions, rather than creating new models.

**Rationale:** DRY principle—reusing tested models ensures consistency and reduces maintenance burden. The existing models already handle edge cases like null decimal handling and flexible invoice ID patterns.

**Alternatives Rejected:**
1. Create new models per function - Rejected because it duplicates validation logic and risks inconsistency
2. Embed models in each function - Rejected because changes require updating 4 places

**Consequences:**
- All functions share the same validation rules (consistent)
- Shared library must be deployed with each function (slight overhead)
- Version changes affect all functions (feature, not bug)

---

### Decision 2: Adapt Existing LLM Gateway for Vertex AI

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-01-29 |

**Context:** The existing `src/invoice_extractor/llm_gateway.py` uses `google.generativeai` (AI Studio SDK). For production Cloud Run, we should use Vertex AI SDK for better authentication and enterprise features.

**Choice:** Create new `GeminiAdapter` in `src/shared/adapters/llm.py` using `google-cloud-aiplatform` SDK with Protocol interface for testability.

**Rationale:** Vertex AI provides:
- Automatic ADC (Application Default Credentials) in Cloud Run
- Better quota management
- Enterprise SLAs
- Native integration with GCP IAM

**Alternatives Rejected:**
1. Keep AI Studio SDK - Rejected because it requires API keys, less suitable for production
2. OpenAI SDK via Vertex AI proxy - Rejected because adds unnecessary complexity

**Consequences:**
- Functions use service account authentication (more secure)
- Slightly different API surface (minor refactoring)
- Better observability via Cloud Logging integration

---

### Decision 3: Protocol-Based Adapters for Testability

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-01-29 |

**Context:** Functions need to interact with GCS, Pub/Sub, BigQuery, and Vertex AI. Direct SDK calls make unit testing difficult.

**Choice:** Define Protocol interfaces in `src/shared/adapters/` with concrete GCP implementations. Inject adapters via dependency injection.

**Rationale:** Protocol pattern enables:
- Unit tests with mock adapters (no GCP calls)
- Integration tests with real adapters
- Future portability if cloud provider changes

**Alternatives Rejected:**
1. Direct SDK calls everywhere - Rejected because makes testing nearly impossible
2. Abstract base classes - Rejected because Protocols are more Pythonic and don't require inheritance

**Consequences:**
- Slightly more code (protocol + implementation)
- Easy to mock in tests
- Clear contracts between layers

---

### Decision 4: Event-Driven with Dead Letter Queues

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-01-29 |

**Context:** Each function must handle failures gracefully without losing invoices.

**Choice:** Each Pub/Sub subscription has a DLQ with 3-5 retry attempts. Failed messages go to DLQ for manual review.

**Rationale:**
- Retries handle transient failures (network, quota)
- DLQ prevents infinite retry loops
- Operations team can manually reprocess DLQ messages

**Alternatives Rejected:**
1. No DLQ (silent failure) - Rejected because invoices could be lost
2. Synchronous error handling - Rejected because blocks pipeline

**Consequences:**
- Need monitoring on DLQ message counts
- Need manual review process for DLQ
- Guaranteed at-least-once processing

---

### Decision 5: Vendor-Specific Prompt Templates

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-01-29 |

**Context:** Different vendors (UberEats, DoorDash, Grubhub, iFood, Rappi) have different invoice layouts. A single generic prompt may not achieve 90% accuracy.

**Choice:** Create 5 vendor-specific prompts in `src/functions/data_extractor/prompts/` plus a generic fallback for "other" vendor type.

**Rationale:**
- Few-shot examples improve LLM accuracy for known formats
- Vendor-specific instructions handle layout differences
- Generic fallback handles unknown vendors

**Alternatives Rejected:**
1. Single generic prompt - Rejected because lower accuracy on varied layouts
2. Fine-tuned models per vendor - Rejected because too expensive for MVP

**Consequences:**
- Need to maintain 6 prompt files
- Classification must happen before extraction
- Can iterate on prompts without code changes

---

## File Manifest

| # | File | Action | Purpose | Agent | Dependencies |
|---|------|--------|---------|-------|--------------|
| **Shared Library** |
| 1 | `src/shared/__init__.py` | Create | Package init | @python-developer | None |
| 2 | `src/shared/schemas/__init__.py` | Create | Schema exports | @python-developer | None |
| 3 | `src/shared/schemas/invoice.py` | Refactor | Pydantic models (from existing) | @python-developer | None |
| 4 | `src/shared/schemas/messages.py` | Create | Pub/Sub message schemas | @python-developer | 3 |
| 5 | `src/shared/adapters/__init__.py` | Create | Adapter exports | @python-developer | None |
| 6 | `src/shared/adapters/storage.py` | Create | StorageAdapter Protocol + GCSAdapter | @function-developer | None |
| 7 | `src/shared/adapters/messaging.py` | Create | MessagingAdapter Protocol + PubSubAdapter | @function-developer | None |
| 8 | `src/shared/adapters/llm.py` | Create | LLMAdapter Protocol + GeminiAdapter | @extraction-specialist | None |
| 9 | `src/shared/adapters/bigquery.py` | Create | BigQueryAdapter Protocol + GCPAdapter | @function-developer | 3 |
| 10 | `src/shared/utils/__init__.py` | Create | Utils exports | @python-developer | None |
| 11 | `src/shared/utils/logging.py` | Create | Structured JSON logging | @python-developer | None |
| 12 | `src/shared/utils/config.py` | Create | Environment configuration | @python-developer | None |
| **Function 1: TIFF-to-PNG Converter** |
| 13 | `src/functions/tiff_to_png/__init__.py` | Create | Package init | @function-developer | None |
| 14 | `src/functions/tiff_to_png/main.py` | Create | Cloud Run entry point | @function-developer | 6, 7, 11 |
| 15 | `src/functions/tiff_to_png/converter.py` | Create | TIFF conversion logic | @function-developer | None |
| 16 | `src/functions/tiff_to_png/requirements.txt` | Create | Dependencies | @function-developer | None |
| **Function 2: Invoice Classifier** |
| 17 | `src/functions/invoice_classifier/__init__.py` | Create | Package init | @function-developer | None |
| 18 | `src/functions/invoice_classifier/main.py` | Create | Cloud Run entry point | @function-developer | 6, 7, 11 |
| 19 | `src/functions/invoice_classifier/classifier.py` | Create | Vendor detection logic | @function-developer | 3 |
| 20 | `src/functions/invoice_classifier/requirements.txt` | Create | Dependencies | @function-developer | None |
| **Function 3: Data Extractor** |
| 21 | `src/functions/data_extractor/__init__.py` | Create | Package init | @extraction-specialist | None |
| 22 | `src/functions/data_extractor/main.py` | Create | Cloud Run entry point | @extraction-specialist | 6, 7, 8, 11 |
| 23 | `src/functions/data_extractor/extractor.py` | Create | LLM extraction orchestration | @extraction-specialist | 3, 8 |
| 24 | `src/functions/data_extractor/prompts/ubereats.txt` | Create | UberEats prompt template | @llm-specialist | None |
| 25 | `src/functions/data_extractor/prompts/doordash.txt` | Create | DoorDash prompt template | @llm-specialist | None |
| 26 | `src/functions/data_extractor/prompts/grubhub.txt` | Create | Grubhub prompt template | @llm-specialist | None |
| 27 | `src/functions/data_extractor/prompts/ifood.txt` | Create | iFood prompt template | @llm-specialist | None |
| 28 | `src/functions/data_extractor/prompts/rappi.txt` | Create | Rappi prompt template | @llm-specialist | None |
| 29 | `src/functions/data_extractor/prompts/generic.txt` | Create | Generic fallback prompt | @llm-specialist | None |
| 30 | `src/functions/data_extractor/requirements.txt` | Create | Dependencies | @extraction-specialist | None |
| **Function 4: BigQuery Writer** |
| 31 | `src/functions/bigquery_writer/__init__.py` | Create | Package init | @function-developer | None |
| 32 | `src/functions/bigquery_writer/main.py` | Create | Cloud Run entry point | @function-developer | 7, 9, 11 |
| 33 | `src/functions/bigquery_writer/writer.py` | Create | BigQuery write logic | @function-developer | 3, 9 |
| 34 | `src/functions/bigquery_writer/requirements.txt` | Create | Dependencies | @function-developer | None |
| **Tests** |
| 35 | `src/tests/__init__.py` | Create | Test package init | @test-generator | None |
| 36 | `src/tests/unit/__init__.py` | Create | Unit test package | @test-generator | None |
| 37 | `src/tests/unit/test_schemas.py` | Create | Schema validation tests | @test-generator | 3 |
| 38 | `src/tests/unit/test_converter.py` | Create | TIFF converter tests | @test-generator | 15 |
| 39 | `src/tests/unit/test_classifier.py` | Create | Classifier tests | @test-generator | 19 |
| 40 | `src/tests/unit/test_extractor.py` | Create | Extractor tests (mocked LLM) | @test-generator | 23 |
| 41 | `src/tests/unit/test_writer.py` | Create | BigQuery writer tests | @test-generator | 33 |
| 42 | `src/tests/integration/__init__.py` | Create | Integration test package | @test-generator | None |
| 43 | `src/tests/integration/test_pipeline.py` | Create | End-to-end pipeline test | @test-generator | 14, 18, 22, 32 |
| 44 | `src/tests/fixtures/sample_invoices.py` | Create | Test fixture data | @test-generator | None |
| 45 | `src/tests/conftest.py` | Create | pytest fixtures | @test-generator | None |

**Total Files:** 45

---

## Agent Assignment Rationale

> Agents discovered from `.claude/agents/` - Build phase invokes matched specialists.

| Agent | Files Assigned | Why This Agent |
|-------|----------------|----------------|
| @python-developer | 1, 2, 3, 4, 5, 10, 11, 12 | Core Python patterns: Pydantic models, dataclasses, type hints |
| @function-developer | 6, 7, 9, 13-20, 31-34 | Cloud Run function patterns, GCP SDK integration |
| @extraction-specialist | 8, 21-23, 30 | LLM extraction, Gemini prompts, Pydantic validation |
| @llm-specialist | 24-29 | Vendor-specific prompt engineering for accuracy |
| @test-generator | 35-45 | pytest fixtures, unit tests, integration tests |

**Agent Discovery:**
- Scanned: `.claude/agents/**/*.md`
- Matched by: File type, purpose keywords, path patterns, KB domains (pydantic, gcp, gemini)

---

## Code Patterns

### Pattern 1: Protocol-Based Adapter

```python
# src/shared/adapters/storage.py
from typing import Protocol
from pathlib import Path


class StorageAdapter(Protocol):
    """Protocol for storage operations - enables testing with mocks."""

    def read(self, bucket: str, path: str) -> bytes:
        """Read file from storage."""
        ...

    def write(self, bucket: str, path: str, data: bytes, content_type: str) -> str:
        """Write file to storage, return GCS URI."""
        ...

    def copy(self, source_bucket: str, source_path: str,
             dest_bucket: str, dest_path: str) -> str:
        """Copy file between buckets."""
        ...

    def delete(self, bucket: str, path: str) -> bool:
        """Delete file from storage."""
        ...


class GCSAdapter:
    """Google Cloud Storage implementation."""

    def __init__(self, project_id: str | None = None):
        from google.cloud import storage
        self._client = storage.Client(project=project_id)

    def read(self, bucket: str, path: str) -> bytes:
        bucket_obj = self._client.bucket(bucket)
        blob = bucket_obj.blob(path)
        return blob.download_as_bytes()

    def write(self, bucket: str, path: str, data: bytes, content_type: str) -> str:
        bucket_obj = self._client.bucket(bucket)
        blob = bucket_obj.blob(path)
        blob.upload_from_string(data, content_type=content_type)
        return f"gs://{bucket}/{path}"

    def copy(self, source_bucket: str, source_path: str,
             dest_bucket: str, dest_path: str) -> str:
        source_bucket_obj = self._client.bucket(source_bucket)
        source_blob = source_bucket_obj.blob(source_path)
        dest_bucket_obj = self._client.bucket(dest_bucket)
        source_bucket_obj.copy_blob(source_blob, dest_bucket_obj, dest_path)
        return f"gs://{dest_bucket}/{dest_path}"

    def delete(self, bucket: str, path: str) -> bool:
        bucket_obj = self._client.bucket(bucket)
        blob = bucket_obj.blob(path)
        blob.delete()
        return True
```

### Pattern 2: Cloud Run Entry Point

```python
# src/functions/tiff_to_png/main.py
import base64
import json
import logging
from typing import Any

import functions_framework
from cloudevents.http import CloudEvent

from shared.adapters.storage import GCSAdapter
from shared.adapters.messaging import PubSubAdapter
from shared.utils.logging import configure_logging
from shared.utils.config import get_config
from .converter import convert_tiff_to_png

# Configure structured logging
configure_logging()
logger = logging.getLogger(__name__)


@functions_framework.cloud_event
def handle_invoice_uploaded(cloud_event: CloudEvent) -> None:
    """Cloud Run entry point - triggered by Pub/Sub.

    Expects CloudEvent with Pub/Sub message containing:
        - bucket: GCS bucket name
        - name: File path in bucket
    """
    config = get_config()
    storage = GCSAdapter(project_id=config.project_id)
    messaging = PubSubAdapter(project_id=config.project_id)

    try:
        # Parse Pub/Sub message
        message_data = base64.b64decode(cloud_event.data["message"]["data"])
        message = json.loads(message_data)

        bucket = message["bucket"]
        file_path = message["name"]

        logger.info(
            "Processing invoice",
            extra={"bucket": bucket, "file_path": file_path}
        )

        # Download TIFF
        tiff_data = storage.read(bucket, file_path)

        # Convert to PNG(s)
        png_files = convert_tiff_to_png(tiff_data)

        # Upload converted files
        converted_paths = []
        for i, png_data in enumerate(png_files):
            png_path = f"{file_path.rsplit('.', 1)[0]}_page{i+1}.png"
            uri = storage.write(
                config.processed_bucket,
                png_path,
                png_data,
                "image/png"
            )
            converted_paths.append(uri)

        # Publish completion event
        messaging.publish(
            config.converted_topic,
            {
                "source_file": f"gs://{bucket}/{file_path}",
                "converted_files": converted_paths,
                "page_count": len(converted_paths)
            }
        )

        logger.info(
            "Conversion complete",
            extra={
                "source_file": file_path,
                "page_count": len(converted_paths)
            }
        )

    except Exception as e:
        logger.exception(
            "Conversion failed",
            extra={"error": str(e), "file_path": file_path}
        )
        raise  # Let Cloud Run retry
```

### Pattern 3: Pub/Sub Message Schema

```python
# src/shared/schemas/messages.py
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from .invoice import VendorType


class InvoiceUploadedMessage(BaseModel):
    """Message published when TIFF lands in input bucket."""
    bucket: str
    name: str
    event_time: datetime = Field(default_factory=datetime.utcnow)


class InvoiceConvertedMessage(BaseModel):
    """Message published after TIFF → PNG conversion."""
    source_file: str = Field(description="gs:// URI of original TIFF")
    converted_files: list[str] = Field(description="List of gs:// URIs for PNGs")
    page_count: int = Field(ge=1, description="Number of pages converted")
    event_time: datetime = Field(default_factory=datetime.utcnow)


class InvoiceClassifiedMessage(BaseModel):
    """Message published after vendor classification."""
    source_file: str
    converted_files: list[str]
    vendor_type: VendorType
    quality_score: float = Field(ge=0.0, le=1.0)
    archived_to: str = Field(description="gs:// URI in archive bucket")
    event_time: datetime = Field(default_factory=datetime.utcnow)


class InvoiceExtractedMessage(BaseModel):
    """Message published after LLM extraction."""
    source_file: str
    vendor_type: VendorType
    extraction_model: Literal["gemini-2.5-flash", "openrouter"]
    extraction_latency_ms: int
    confidence_score: float = Field(ge=0.0, le=1.0)
    extracted_data: dict  # ExtractedInvoice as dict
    event_time: datetime = Field(default_factory=datetime.utcnow)
```

### Pattern 4: Vendor-Specific Prompt Template

```text
# src/functions/data_extractor/prompts/ubereats.txt
You are an expert invoice data extractor specializing in UberEats restaurant partner invoices.

Extract all invoice data from the provided image(s) and return ONLY valid JSON matching this schema:

{schema}

## UberEats Invoice Patterns:
- Invoice ID format: "UE-YYYY-NNNNNN" or similar
- Vendor name: Restaurant name (not "Uber Eats")
- Currency: Usually USD or BRL
- Commission rate: Typically 15-30% (0.15-0.30)
- Line items: Look for "Order Sales", "Delivery Fees", "Promotions"

## Extraction Rules:
1. Extract ALL line items with descriptions, quantities, and amounts
2. Calculate subtotal as sum of line item amounts
3. Extract tax_amount if shown (may be $0.00)
4. Extract commission_rate as decimal (e.g., 0.15 for 15%)
5. Calculate commission_amount = subtotal × commission_rate
6. total_amount should match the invoice total

## Example Output:
```json
{
  "invoice_id": "UE-2026-001234",
  "vendor_name": "Restaurant ABC",
  "vendor_type": "ubereats",
  "invoice_date": "2026-01-15",
  "due_date": "2026-02-15",
  "currency": "USD",
  "line_items": [
    {"description": "Order Sales", "quantity": 1, "unit_price": "500.00"},
    {"description": "Delivery Fees Collected", "quantity": 1, "unit_price": "45.00"}
  ],
  "subtotal": "545.00",
  "tax_amount": "0.00",
  "commission_rate": "0.15",
  "commission_amount": "81.75",
  "total_amount": "545.00"
}
```

Return ONLY the JSON object, no markdown formatting or explanations.
```

### Pattern 5: Configuration Management

```python
# src/shared/utils/config.py
from dataclasses import dataclass
from functools import lru_cache
import os


@dataclass(frozen=True)
class Config:
    """Application configuration from environment variables."""

    # GCP
    project_id: str
    region: str

    # Buckets
    input_bucket: str
    processed_bucket: str
    archive_bucket: str
    failed_bucket: str

    # Topics
    uploaded_topic: str
    converted_topic: str
    classified_topic: str
    extracted_topic: str

    # LLM
    gemini_model: str
    openrouter_api_key: str | None

    # BigQuery
    dataset: str
    invoices_table: str
    line_items_table: str


@lru_cache(maxsize=1)
def get_config() -> Config:
    """Load configuration from environment (cached)."""
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "invoice-pipeline-dev")

    return Config(
        project_id=project_id,
        region=os.environ.get("GCP_REGION", "us-central1"),

        input_bucket=f"{project_id}-invoices-input",
        processed_bucket=f"{project_id}-invoices-processed",
        archive_bucket=f"{project_id}-invoices-archive",
        failed_bucket=f"{project_id}-invoices-failed",

        uploaded_topic="invoice-uploaded",
        converted_topic="invoice-converted",
        classified_topic="invoice-classified",
        extracted_topic="invoice-extracted",

        gemini_model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
        openrouter_api_key=os.environ.get("OPENROUTER_API_KEY"),

        dataset="invoices",
        invoices_table="extracted_invoices",
        line_items_table="line_items"
    )
```

### Pattern 6: Structured JSON Logging

```python
# src/shared/utils/logging.py
import json
import logging
import sys
from typing import Any


class StructuredLogFormatter(logging.Formatter):
    """Format logs as JSON for Cloud Logging."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "severity": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "timestamp": self.formatTime(record),
        }

        # Add extra fields
        if hasattr(record, "__dict__"):
            for key, value in record.__dict__.items():
                if key not in ("name", "msg", "args", "created", "filename",
                              "funcName", "levelname", "levelno", "lineno",
                              "module", "msecs", "pathname", "process",
                              "processName", "relativeCreated", "stack_info",
                              "thread", "threadName", "exc_info", "exc_text",
                              "message"):
                    log_entry[key] = value

        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry)


def configure_logging(level: int = logging.INFO) -> None:
    """Configure structured logging for Cloud Run."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredLogFormatter())

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers = [handler]
```

---

## Data Flow

```text
1. Finance team uploads TIFF invoice to gs://invoices-input
   │
   ▼
2. GCS notification publishes to `invoice-uploaded` topic
   │
   ▼
3. tiff-to-png-converter receives event:
   ├── Downloads TIFF from GCS
   ├── Converts to PNG (handles multi-page)
   ├── Uploads PNG(s) to gs://invoices-processed
   └── Publishes to `invoice-converted` topic
   │
   ▼
4. invoice-classifier receives event:
   ├── Downloads PNG(s) from GCS
   ├── Validates image quality (resolution, clarity)
   ├── Detects vendor type (filename pattern or LLM)
   ├── Archives original TIFF to gs://invoices-archive
   └── Publishes to `invoice-classified` topic (includes vendor_type)
   │
   ▼
5. data-extractor receives event:
   ├── Downloads PNG(s) from GCS
   ├── Loads vendor-specific prompt template
   ├── Calls Gemini 2.5 Flash via Vertex AI
   ├── Validates response with Pydantic
   ├── On failure: retries → OpenRouter fallback → gs://invoices-failed
   └── Publishes to `invoice-extracted` topic (includes JSON data)
   │
   ▼
6. bigquery-writer receives event:
   ├── Re-validates with Pydantic (defense in depth)
   ├── Checks for duplicates (invoice_id)
   ├── Writes to invoices.extracted_invoices table
   ├── Writes line items to invoices.line_items table
   └── Logs metrics to invoices.extraction_metrics table
```

---

## Integration Points

| External System | Integration Type | Authentication |
|-----------------|-----------------|----------------|
| **GCS** | Cloud Storage SDK | Service Account (ADC) |
| **Pub/Sub** | Cloud Pub/Sub SDK | Service Account (ADC) |
| **BigQuery** | BigQuery SDK | Service Account (ADC) |
| **Vertex AI (Gemini)** | Vertex AI SDK | Service Account (ADC) |
| **OpenRouter** | REST API | API Key (Secret Manager) |

---

## Testing Strategy

| Test Type | Scope | Files | Tools | Coverage Goal |
|-----------|-------|-------|-------|---------------|
| **Unit** | Individual functions | `test_*.py` | pytest + pytest-mock | 80% |
| **Integration** | Multi-function flow | `test_pipeline.py` | pytest + testcontainers | Key paths |
| **Accuracy** | LLM extraction | Manual | Ground truth comparison | 90% per field |
| **E2E** | Full pipeline | Manual deploy | gcloud + sample data | Happy path |

### Unit Test Strategy

```python
# Example: Testing extractor with mocked LLM
def test_extract_invoice_success(mocker):
    """Test extraction with mocked Gemini response."""
    mock_llm = mocker.Mock()
    mock_llm.extract.return_value = LLMResponse(
        success=True,
        content='{"invoice_id": "UE-2026-001234", ...}',
        provider="gemini",
        latency_ms=500
    )

    result = extract_invoice(
        image_paths=[Path("test.png")],
        prompt="...",
        llm_adapter=mock_llm
    )

    assert result.success
    assert result.invoice.invoice_id == "UE-2026-001234"
```

---

## Error Handling

| Error Type | Handling Strategy | Retry? |
|------------|-------------------|--------|
| GCS read/write failure | Log error, raise for Cloud Run retry | Yes (3x) |
| Pub/Sub publish failure | Log error, raise for Cloud Run retry | Yes (3x) |
| LLM timeout | Retry with exponential backoff | Yes (2x) |
| LLM rate limit | Exponential backoff, then OpenRouter | Yes (2x) |
| LLM invalid response | Parse error → OpenRouter fallback | Yes (1x) |
| Pydantic validation failure | Copy to gs://failed, log details | No |
| BigQuery write failure | Log error, raise for Cloud Run retry | Yes (5x) |
| Duplicate invoice | Log warning, skip insert | No |

---

## Configuration

| Config Key | Type | Default | Description |
|------------|------|---------|-------------|
| `GOOGLE_CLOUD_PROJECT` | string | `invoice-pipeline-dev` | GCP project ID |
| `GCP_REGION` | string | `us-central1` | GCP region |
| `GEMINI_MODEL` | string | `gemini-2.5-flash` | Vertex AI model name |
| `OPENROUTER_API_KEY` | string | (secret) | Fallback LLM API key |
| `LOG_LEVEL` | string | `INFO` | Logging level |

---

## Security Considerations

- **Least Privilege:** Each function has its own service account with minimal IAM roles
- **No API Keys in Code:** OpenRouter key stored in Secret Manager
- **ADC Authentication:** All GCP services use Application Default Credentials
- **Input Validation:** All Pub/Sub messages validated with Pydantic before processing
- **No PII Logging:** Invoice content never logged at INFO level

---

## Observability

| Aspect | Implementation |
|--------|----------------|
| **Logging** | Structured JSON to Cloud Logging (stdout) |
| **Metrics** | extraction_metrics BigQuery table + Cloud Monitoring custom metrics |
| **Alerting** | Cloud Monitoring alerts on DLQ message count > 10 |
| **Tracing** | Cloud Trace (automatic for Cloud Run) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | design-agent | Initial version |

---

## Next Step

**Ready for:** `/build .claude/sdd/features/DESIGN_INVOICE_PIPELINE.md`
