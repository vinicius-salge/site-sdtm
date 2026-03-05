# DESIGN: GCP Pipeline Deployment

> Technical design for deploying complete invoice extraction pipeline to GCP with 4 Cloud Run functions

## Metadata

| Attribute | Value |
|-----------|-------|
| **Feature** | GCP_PIPELINE_DEPLOYMENT |
| **Date** | 2026-01-29 |
| **Author** | design-agent |
| **DEFINE** | [DEFINE_GCP_PIPELINE_DEPLOYMENT.md](./DEFINE_GCP_PIPELINE_DEPLOYMENT.md) |
| **Status** | Ready for Build |

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           INVOICE EXTRACTION PIPELINE                                │
│                              GCP Dev Environment                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  INGESTION                     PROCESSING                           STORAGE          │
│  ─────────                     ──────────                           ───────          │
│                                                                                      │
│  ┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐            │
│  │  TIFF   │     │   CONVERT   │     │  CLASSIFY   │     │   EXTRACT   │            │
│  │ Landing │────▶│  TIFF→PNG   │────▶│ Vendor Type │────▶│   Gemini    │            │
│  │  (GCS)  │     │             │     │             │     │  2.0 Flash  │            │
│  └─────────┘     └─────────────┘     └─────────────┘     └─────────────┘            │
│       │               │                   │                    │                     │
│       ▼               ▼                   ▼                    ▼                     │
│  ┌─────────┐     ┌─────────┐        ┌─────────┐          ┌─────────┐                │
│  │uploaded │     │converted│        │classified│          │extracted│                │
│  │ (topic) │     │ (topic) │        │ (topic)  │          │ (topic) │                │
│  └─────────┘     └─────────┘        └─────────┘          └─────────┘                │
│                                                                │                     │
│                                                                ▼                     │
│                                                          ┌─────────────┐            │
│                                                          │   WRITE     │            │
│                                                          │  BigQuery   │────────────│
│                                                          │             │    ┌──────┐│
│                                                          └─────────────┘    │  BQ  ││
│                                                                │            │Tables││
│                                                                ▼            └──────┘│
│                                                          ┌─────────┐                │
│                                                          │ loaded  │                │
│                                                          │ (topic) │                │
│                                                          └─────────┘                │
│                                                                                      │
│  ERROR HANDLING                                                                      │
│  ──────────────                                                                      │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐        │
│  │ failed  │     │  DLQ    │     │  DLQ    │     │  DLQ    │     │  DLQ    │        │
│  │ (GCS)   │     │uploaded │     │converted│     │classified│     │extracted│        │
│  └─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘        │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Components

| Component | Purpose | Technology | Memory | Timeout |
|-----------|---------|------------|--------|---------|
| **fnc-tiff-converter-dev** | Convert multi-page TIFF to PNG images | Python 3.11 + Pillow | 1Gi | 300s |
| **fnc-invoice-classifier-dev** | Detect vendor type from invoice | Python 3.11 + regex patterns | 512Mi | 120s |
| **fnc-data-extractor-dev** | Extract data using Gemini 2.0 Flash | Python 3.11 + Vertex AI SDK | 2Gi | 540s |
| **fnc-bigquery-writer-dev** | Validate and write to BigQuery | Python 3.11 + BigQuery SDK | 512Mi | 120s |

---

## Key Decisions

### Decision 1: Shared Base Image for All Functions

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-01-29 |

**Context:** Four Cloud Run functions need consistent Python environment with common dependencies.

**Choice:** Use a single `python:3.11-slim` base with shared requirements, built separately for each function.

**Rationale:**
- Reduces maintenance - one Python version to track
- Consistent behavior across functions
- Faster builds with Docker layer caching

**Alternatives Rejected:**
1. Function-specific images - Rejected because increases maintenance burden
2. Google Cloud Functions (gen2) - Rejected because less control over dependencies

**Consequences:**
- All functions share Python 3.11 runtime
- Each function has its own Dockerfile but same base
- Need to manage shared vs function-specific requirements

---

### Decision 2: Pub/Sub Push Subscriptions (not Pull)

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-01-29 |

**Context:** Need to trigger Cloud Run functions from Pub/Sub messages.

**Choice:** Use Pub/Sub push subscriptions to Cloud Run endpoints.

**Rationale:**
- Automatic invocation - no polling required
- Built-in retry and DLQ support
- Native Cloud Run integration
- Scales to zero when idle

**Alternatives Rejected:**
1. Pull subscriptions with worker - Rejected because requires always-on compute
2. Eventarc triggers - Rejected because adds complexity for Pub/Sub (GCS uses Eventarc)

**Consequences:**
- Functions receive HTTP POST with Pub/Sub message body
- Must parse CloudEvent or Pub/Sub push format
- Functions must be idempotent (may receive duplicates)

---

### Decision 3: Pydantic for All Data Validation

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-01-29 |

**Context:** Need consistent data validation for messages between functions and for LLM output parsing.

**Choice:** Use Pydantic v2 models for all data structures.

**Rationale:**
- Existing schemas in `gen/synthetic-invoice-gen/src/invoice_gen/schemas/`
- Native JSON Schema generation for Gemini structured output
- Runtime validation with clear error messages
- Type hints for IDE support

**Alternatives Rejected:**
1. dataclasses + manual validation - Rejected because more code, less safety
2. marshmallow - Rejected because Pydantic is project standard

**Consequences:**
- All functions share common schema package
- Can reuse `VendorType` enum and `InvoiceData` model
- Extraction function uses Pydantic model for Gemini response

---

### Decision 4: Vendor Detection via Pattern Matching

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-01-29 |

**Context:** Classifier function needs to detect vendor type (UberEats, DoorDash, etc.) from PNG images.

**Choice:** Use regex pattern matching on invoice ID format as primary classification.

**Rationale:**
- Invoice IDs have distinct patterns: `UE-`, `DD-`, `GH-`, `IF-`, `RP-`
- Fast and deterministic
- No LLM cost for classification
- Can extract invoice ID for downstream use

**Alternatives Rejected:**
1. OCR + keyword search - Rejected because slower, more complex
2. LLM classification - Rejected because unnecessary cost for simple task
3. Image hash matching - Rejected because templates may change

**Consequences:**
- Classification is fast (<1s per invoice)
- Relies on consistent invoice ID formats
- Falls back to "other" for unknown formats

---

### Decision 5: Sequential File Processing (Concurrency=1)

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-01-29 |

**Context:** Cloud Run functions can handle concurrent requests. LLM calls are expensive.

**Choice:** Set concurrency=1 for all functions, especially the extractor.

**Rationale:**
- Prevents resource contention within function
- Simpler error handling
- LLM calls should be sequential to avoid rate limits
- Pub/Sub handles queueing automatically

**Alternatives Rejected:**
1. High concurrency (10+) - Rejected because may hit Gemini rate limits
2. Batch processing - Rejected because adds complexity

**Consequences:**
- One invoice processed at a time per function instance
- Horizontal scaling via multiple instances
- Predictable memory usage per request

---

## File Manifest

### Infrastructure Scripts

| # | File | Action | Purpose | Dependencies |
|---|------|--------|---------|--------------|
| 1 | `deploy/scripts/00-env-setup.sh` | Create | Environment variables and prerequisites | None |
| 2 | `deploy/scripts/01-enable-apis.sh` | Create | Enable GCP APIs | 1 |
| 3 | `deploy/scripts/02-create-buckets.sh` | Create | Create 7 GCS buckets with lifecycle | 1, 2 |
| 4 | `deploy/scripts/03-create-pubsub.sh` | Create | Create 10 topics and subscriptions | 1, 2 |
| 5 | `deploy/scripts/04-create-bigquery.sh` | Create | Create dataset and 3 tables | 1, 2 |
| 6 | `deploy/scripts/05-create-secrets.sh` | Create | Create 5 secrets in Secret Manager | 1, 2 |
| 7 | `deploy/scripts/06-create-iam.sh` | Create | Create 5 service accounts with IAM | 1, 2 |
| 8 | `deploy/scripts/99-cleanup.sh` | Create | Delete all resources | 1 |

### Shared Code

| # | File | Action | Purpose | Dependencies |
|---|------|--------|---------|--------------|
| 9 | `src/shared/__init__.py` | Create | Shared package init | None |
| 10 | `src/shared/schemas.py` | Create | Pydantic models (reuse from gen/) | None |
| 11 | `src/shared/pubsub.py` | Create | Pub/Sub message parsing and publishing | 10 |
| 12 | `src/shared/storage.py` | Create | GCS upload/download utilities | None |
| 13 | `src/shared/config.py` | Create | Environment configuration | None |
| 14 | `src/shared/logging.py` | Create | Structured JSON logging | None |

### Function 1: TIFF Converter

| # | File | Action | Purpose | Dependencies |
|---|------|--------|---------|--------------|
| 15 | `src/functions/tiff_converter/__init__.py` | Create | Package init | None |
| 16 | `src/functions/tiff_converter/main.py` | Create | Cloud Run entry point | 17, 18 |
| 17 | `src/functions/tiff_converter/handler.py` | Create | TIFF to PNG conversion logic | 11, 12 |
| 18 | `src/functions/tiff_converter/converter.py` | Create | Pillow image processing | None |
| 19 | `src/functions/tiff_converter/Dockerfile` | Create | Container image definition | None |
| 20 | `src/functions/tiff_converter/requirements.txt` | Create | Python dependencies | None |

### Function 2: Invoice Classifier

| # | File | Action | Purpose | Dependencies |
|---|------|--------|---------|--------------|
| 21 | `src/functions/invoice_classifier/__init__.py` | Create | Package init | None |
| 22 | `src/functions/invoice_classifier/main.py` | Create | Cloud Run entry point | 23, 24 |
| 23 | `src/functions/invoice_classifier/handler.py` | Create | Classification orchestration | 11, 12 |
| 24 | `src/functions/invoice_classifier/classifier.py` | Create | Vendor detection via patterns | 10 |
| 25 | `src/functions/invoice_classifier/Dockerfile` | Create | Container image definition | None |
| 26 | `src/functions/invoice_classifier/requirements.txt` | Create | Python dependencies | None |

### Function 3: Data Extractor

| # | File | Action | Purpose | Dependencies |
|---|------|--------|---------|--------------|
| 27 | `src/functions/data_extractor/__init__.py` | Create | Package init | None |
| 28 | `src/functions/data_extractor/main.py` | Create | Cloud Run entry point | 29, 30 |
| 29 | `src/functions/data_extractor/handler.py` | Create | Extraction orchestration | 11, 12 |
| 30 | `src/functions/data_extractor/extractor.py` | Create | Gemini API integration | 10, 31 |
| 31 | `src/functions/data_extractor/prompts.py` | Create | Vendor-specific prompt templates | None |
| 32 | `src/functions/data_extractor/Dockerfile` | Create | Container image definition | None |
| 33 | `src/functions/data_extractor/requirements.txt` | Create | Python dependencies | None |

### Function 4: BigQuery Writer

| # | File | Action | Purpose | Dependencies |
|---|------|--------|---------|--------------|
| 34 | `src/functions/bigquery_writer/__init__.py` | Create | Package init | None |
| 35 | `src/functions/bigquery_writer/main.py` | Create | Cloud Run entry point | 36, 37 |
| 36 | `src/functions/bigquery_writer/handler.py` | Create | Write orchestration | 11, 12 |
| 37 | `src/functions/bigquery_writer/writer.py` | Create | BigQuery insert logic | 10 |
| 38 | `src/functions/bigquery_writer/Dockerfile` | Create | Container image definition | None |
| 39 | `src/functions/bigquery_writer/requirements.txt` | Create | Python dependencies | None |

### Deployment Scripts

| # | File | Action | Purpose | Dependencies |
|---|------|--------|---------|--------------|
| 40 | `deploy/scripts/10-build-images.sh` | Create | Build all Docker images | 19, 25, 32, 38 |
| 41 | `deploy/scripts/11-push-images.sh` | Create | Push to Artifact Registry | 40 |
| 42 | `deploy/scripts/12-deploy-functions.sh` | Create | Deploy Cloud Run services | 41, 6, 7 |
| 43 | `deploy/scripts/13-create-triggers.sh` | Create | Create Pub/Sub push subscriptions | 42 |
| 44 | `deploy/scripts/20-validate.sh` | Create | Validate deployment | 43 |
| 45 | `deploy/scripts/21-test-e2e.sh` | Create | End-to-end test with sample | 44 |

### Configuration

| # | File | Action | Purpose | Dependencies |
|---|------|--------|---------|--------------|
| 46 | `deploy/config/env.dev.yaml` | Create | Dev environment configuration | None |
| 47 | `deploy/config/schemas/bigquery-extractions.json` | Create | BigQuery table schema | None |
| 48 | `deploy/config/schemas/bigquery-line-items.json` | Create | BigQuery table schema | None |
| 49 | `deploy/config/schemas/bigquery-logs.json` | Create | BigQuery table schema | None |

**Total Files:** 49

---

## Code Patterns

### Pattern 1: Cloud Run Entry Point (Flask)

```python
"""Cloud Run entry point using Flask for Pub/Sub push."""

import json
import base64
from flask import Flask, request

from handler import handle_message
from shared.logging import get_logger

app = Flask(__name__)
logger = get_logger(__name__)


@app.route("/", methods=["POST"])
def index():
    """Handle Pub/Sub push subscription."""
    envelope = request.get_json()

    if not envelope:
        logger.error("No Pub/Sub message received")
        return "Bad Request: no message", 400

    if not isinstance(envelope, dict) or "message" not in envelope:
        logger.error("Invalid Pub/Sub message format")
        return "Bad Request: invalid format", 400

    pubsub_message = envelope["message"]

    if isinstance(pubsub_message.get("data"), str):
        data = base64.b64decode(pubsub_message["data"]).decode("utf-8")
        message = json.loads(data)
    else:
        message = {}

    attributes = pubsub_message.get("attributes", {})
    message_id = pubsub_message.get("messageId", "unknown")

    logger.info(f"Processing message {message_id}", extra={"message_id": message_id})

    try:
        result = handle_message(message, attributes)
        logger.info(f"Successfully processed {message_id}")
        return result, 200
    except Exception as e:
        logger.exception(f"Failed to process {message_id}: {e}")
        # Return 500 to trigger Pub/Sub retry
        return f"Error: {e}", 500


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
```

### Pattern 2: Structured Logging

```python
"""Structured JSON logging for Cloud Run."""

import json
import logging
import sys
from typing import Any


class StructuredFormatter(logging.Formatter):
    """Format logs as JSON for Cloud Logging."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "severity": record.levelname,
            "message": record.getMessage(),
            "component": record.name,
            "timestamp": self.formatTime(record),
        }

        # Add extra fields
        if hasattr(record, "invoice_id"):
            log_entry["invoice_id"] = record.invoice_id
        if hasattr(record, "message_id"):
            log_entry["message_id"] = record.message_id
        if hasattr(record, "vendor_type"):
            log_entry["vendor_type"] = record.vendor_type

        # Add exception info
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry)


def get_logger(name: str) -> logging.Logger:
    """Get a structured logger."""
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(StructuredFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

    return logger
```

### Pattern 3: GCS Storage Utility

```python
"""GCS storage utilities for upload/download."""

from pathlib import Path
from typing import Generator
import io

from google.cloud import storage


class StorageClient:
    """GCS storage operations."""

    def __init__(self, project_id: str):
        self.client = storage.Client(project=project_id)

    def download_blob(self, bucket_name: str, blob_name: str) -> bytes:
        """Download blob as bytes."""
        bucket = self.client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        return blob.download_as_bytes()

    def upload_blob(
        self,
        bucket_name: str,
        blob_name: str,
        data: bytes,
        content_type: str = "application/octet-stream"
    ) -> str:
        """Upload bytes to GCS. Returns gs:// URI."""
        bucket = self.client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        blob.upload_from_string(data, content_type=content_type)
        return f"gs://{bucket_name}/{blob_name}"

    def copy_blob(
        self,
        source_bucket: str,
        source_blob: str,
        dest_bucket: str,
        dest_blob: str
    ) -> str:
        """Copy blob between buckets. Returns destination URI."""
        source_bucket_obj = self.client.bucket(source_bucket)
        source_blob_obj = source_bucket_obj.blob(source_blob)
        dest_bucket_obj = self.client.bucket(dest_bucket)

        source_bucket_obj.copy_blob(source_blob_obj, dest_bucket_obj, dest_blob)
        return f"gs://{dest_bucket}/{dest_blob}"

    def list_blobs(
        self,
        bucket_name: str,
        prefix: str
    ) -> Generator[storage.Blob, None, None]:
        """List blobs with prefix."""
        bucket = self.client.bucket(bucket_name)
        return bucket.list_blobs(prefix=prefix)
```

### Pattern 4: Pub/Sub Message Publishing

```python
"""Pub/Sub message publishing utility."""

import json
from google.cloud import pubsub_v1


class PubSubPublisher:
    """Publish messages to Pub/Sub topics."""

    def __init__(self, project_id: str):
        self.publisher = pubsub_v1.PublisherClient()
        self.project_id = project_id

    def publish(
        self,
        topic_name: str,
        data: dict,
        attributes: dict | None = None
    ) -> str:
        """Publish message to topic. Returns message ID."""
        topic_path = self.publisher.topic_path(self.project_id, topic_name)

        message_bytes = json.dumps(data).encode("utf-8")

        future = self.publisher.publish(
            topic_path,
            message_bytes,
            **(attributes or {})
        )

        return future.result()
```

### Pattern 5: Pydantic Extraction Schema

```python
"""Pydantic models for invoice extraction."""

from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class VendorType(str, Enum):
    UBEREATS = "ubereats"
    DOORDASH = "doordash"
    GRUBHUB = "grubhub"
    IFOOD = "ifood"
    RAPPI = "rappi"
    OTHER = "other"


class ExtractedLineItem(BaseModel):
    """Line item from extraction."""
    description: str = Field(..., min_length=1)
    quantity: int = Field(..., ge=1)
    unit_price: float = Field(..., ge=0)
    amount: float = Field(..., ge=0)


class InvoiceExtraction(BaseModel):
    """Structured extraction result from Gemini."""
    invoice_id: str = Field(..., min_length=1, description="Invoice identifier")
    vendor_name: str = Field(..., min_length=1, description="Restaurant name")
    vendor_type: VendorType = Field(..., description="Delivery platform")
    invoice_date: date = Field(..., description="Invoice date")
    due_date: date = Field(..., description="Payment due date")
    subtotal: float = Field(..., ge=0, description="Subtotal before fees")
    tax_amount: float = Field(default=0, ge=0, description="Tax amount")
    commission_rate: Optional[float] = Field(None, ge=0, le=1, description="Commission %")
    commission_amount: Optional[float] = Field(None, ge=0, description="Commission $")
    total_amount: float = Field(..., ge=0, description="Final total")
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    line_items: list[ExtractedLineItem] = Field(..., min_length=1)

    class Config:
        json_schema_extra = {
            "example": {
                "invoice_id": "UE-2026-123456",
                "vendor_name": "Pizza Palace",
                "vendor_type": "ubereats",
                "invoice_date": "2026-01-15",
                "due_date": "2026-02-15",
                "subtotal": 125.50,
                "tax_amount": 10.04,
                "commission_rate": 0.15,
                "commission_amount": 18.83,
                "total_amount": 135.54,
                "currency": "USD",
                "line_items": [
                    {"description": "Large Pizza", "quantity": 2, "unit_price": 25.00, "amount": 50.00}
                ]
            }
        }
```

### Pattern 6: Gemini Extraction with Pydantic

```python
"""Gemini extraction with structured output."""

import base64
from google.cloud import aiplatform
from vertexai.generative_models import GenerativeModel, Part

from shared.schemas import InvoiceExtraction, VendorType


class GeminiExtractor:
    """Extract invoice data using Gemini 2.0 Flash."""

    EXTRACTION_PROMPT = """You are an expert invoice data extractor. Analyze this delivery platform invoice image and extract all data into the specified JSON schema.

RULES:
- Extract ALL visible fields accurately
- Dates should be in YYYY-MM-DD format
- Amounts should be numeric (no currency symbols)
- If a field is not visible, use null
- Invoice ID formats: UE-YYYY-XXXXXX (UberEats), DD-XXXXXX (DoorDash), etc.

Extract the invoice data:"""

    def __init__(self, project_id: str, region: str, model_id: str = "gemini-2.0-flash"):
        aiplatform.init(project=project_id, location=region)
        self.model = GenerativeModel(model_id)

    def extract(self, image_bytes: bytes, vendor_type: VendorType) -> InvoiceExtraction:
        """Extract invoice data from image."""

        # Encode image
        image_data = base64.b64encode(image_bytes).decode("utf-8")
        image_part = Part.from_data(image_bytes, mime_type="image/png")

        # Generate with JSON schema
        response = self.model.generate_content(
            [self.EXTRACTION_PROMPT, image_part],
            generation_config={
                "temperature": 0.1,
                "max_output_tokens": 4096,
                "response_mime_type": "application/json",
                "response_schema": InvoiceExtraction.model_json_schema()
            }
        )

        # Parse and validate with Pydantic
        extraction = InvoiceExtraction.model_validate_json(response.text)

        # Override vendor_type with classified value
        extraction.vendor_type = vendor_type

        return extraction
```

### Pattern 7: Dockerfile Template

```dockerfile
# Base image for Cloud Run functions
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (for Pillow)
RUN apt-get update && apt-get install -y \
    libjpeg-dev \
    zlib1g-dev \
    libtiff-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared code
COPY ../../shared ./shared

# Copy function code
COPY . .

# Run as non-root user
RUN useradd -m appuser && chown -R appuser /app
USER appuser

# Cloud Run expects PORT env var
ENV PORT=8080
EXPOSE 8080

# Start Flask server
CMD ["python", "main.py"]
```

---

## Data Flow

```text
1. TIFF Upload to GCS
   │
   │  User uploads invoice.tiff to gs://eda-gemini-dev-landing/invoices/2026/01/29/
   │
   ▼
2. GCS Notification → Pub/Sub
   │
   │  GCS sends OBJECT_FINALIZE event to tpc-invoice-uploaded-dev
   │  Message: {bucket, name, contentType, size, timeCreated}
   │
   ▼
3. TIFF Converter Function
   │
   │  - Downloads TIFF from landing bucket
   │  - Extracts pages as PNG images
   │  - Uploads PNGs to gs://eda-gemini-dev-converted/{invoice_id}/
   │  - Publishes to tpc-invoice-converted-dev
   │  Message: {invoice_id, png_paths[], page_count, source_file}
   │
   ▼
4. Invoice Classifier Function
   │
   │  - Downloads first PNG page
   │  - Extracts text (simple OCR or filename pattern)
   │  - Detects vendor type (ubereats, doordash, etc.)
   │  - Copies PNGs to gs://eda-gemini-dev-classified/{vendor_type}/
   │  - Publishes to tpc-invoice-classified-dev
   │  Message: {invoice_id, vendor_type, confidence, png_paths[]}
   │
   ▼
5. Data Extractor Function
   │
   │  - Downloads PNG from classified bucket
   │  - Loads vendor-specific prompt template
   │  - Calls Gemini 2.0 Flash with image
   │  - Validates response with Pydantic
   │  - Saves JSON to gs://eda-gemini-dev-extracted/
   │  - Publishes to tpc-invoice-extracted-dev
   │  Message: {invoice_id, extraction: InvoiceExtraction, source_file}
   │
   ▼
6. BigQuery Writer Function
   │
   │  - Validates extraction schema
   │  - Generates row_id (UUID)
   │  - Checks for duplicates (invoice_id)
   │  - Inserts into tb_extractions
   │  - Inserts line items into tb_line_items
   │  - Archives original to gs://eda-gemini-dev-archive/
   │  - Publishes to tpc-invoice-loaded-dev
   │  Message: {invoice_id, row_id, status: "success", bq_table}
   │
   ▼
7. Data Available in BigQuery
   │
   │  SELECT * FROM ds_bq_gemini_dev.tb_extractions
   │  WHERE invoice_id = 'UE-2026-123456'
   │
   ▼
8. (Future) Monitoring/Alerting

   tpc-invoice-loaded-dev consumed by monitoring system
```

---

## Integration Points

| External System | Integration Type | Authentication |
|-----------------|-----------------|----------------|
| **Google Cloud Storage** | SDK (google-cloud-storage) | Service Account |
| **Google Cloud Pub/Sub** | SDK (google-cloud-pubsub) | Service Account |
| **Google BigQuery** | SDK (google-cloud-bigquery) | Service Account |
| **Vertex AI (Gemini)** | SDK (google-cloud-aiplatform) | Service Account + API Key |
| **Secret Manager** | SDK (google-cloud-secretmanager) | Service Account |
| **Artifact Registry** | Docker push | gcloud auth |

---

## Testing Strategy

| Test Type | Scope | Files | Tools | Coverage Goal |
|-----------|-------|-------|-------|---------------|
| **Unit** | Individual functions | `tests/unit/test_*.py` | pytest | 80% |
| **Integration** | GCS/Pub/Sub mocks | `tests/integration/` | pytest + testcontainers | Key paths |
| **E2E** | Full pipeline | `deploy/scripts/21-test-e2e.sh` | gcloud CLI | Happy path |

### Unit Test Example

```python
"""Unit tests for TIFF converter."""

import pytest
from PIL import Image
from io import BytesIO

from functions.tiff_converter.converter import TiffToImage


class TestTiffConverter:

    def test_single_page_tiff(self, sample_single_tiff):
        """Test converting single-page TIFF."""
        converter = TiffToImage()
        images = converter.convert(sample_single_tiff)

        assert len(images) == 1
        assert images[0].mode in ("RGB", "L")

    def test_multi_page_tiff(self, sample_multi_tiff):
        """Test converting multi-page TIFF."""
        converter = TiffToImage()
        images = converter.convert(sample_multi_tiff)

        assert len(images) > 1
        for img in images:
            assert isinstance(img, Image.Image)

    def test_invalid_tiff(self):
        """Test handling invalid TIFF."""
        converter = TiffToImage()

        with pytest.raises(ValueError, match="Invalid TIFF"):
            converter.convert(b"not a tiff")
```

---

## Error Handling

| Error Type | Handling Strategy | Retry? | DLQ? |
|------------|-------------------|--------|------|
| **Invalid TIFF format** | Log error, move to failed bucket | No | Yes |
| **GCS download failure** | Return 500 to trigger Pub/Sub retry | Yes (3x) | Yes |
| **Gemini API timeout** | Return 500 to trigger retry | Yes (3x) | Yes |
| **Gemini rate limit** | Exponential backoff, retry | Yes (3x) | Yes |
| **Pydantic validation** | Log error, move to failed bucket | No | Yes |
| **BigQuery insert failure** | Return 500 to trigger retry | Yes (5x) | Yes |
| **Duplicate invoice_id** | Skip insert, log warning | No | No |

---

## Configuration

### Environment Variables (All Functions)

| Config Key | Type | Default | Description |
|------------|------|---------|-------------|
| `PROJECT_ID` | string | required | GCP project ID |
| `ENV` | string | `dev` | Environment (dev/prod) |
| `REGION` | string | `us-central1` | GCP region |

### Function-Specific Variables

**tiff-converter:**
| Key | Default | Description |
|-----|---------|-------------|
| `SOURCE_BUCKET` | `eda-gemini-dev-landing` | Input bucket |
| `DEST_BUCKET` | `eda-gemini-dev-converted` | Output bucket |
| `OUTPUT_TOPIC` | `tpc-invoice-converted-dev` | Next topic |
| `FAILED_BUCKET` | `eda-gemini-dev-failed` | Error bucket |

**invoice-classifier:**
| Key | Default | Description |
|-----|---------|-------------|
| `SOURCE_BUCKET` | `eda-gemini-dev-converted` | Input bucket |
| `DEST_BUCKET` | `eda-gemini-dev-classified` | Output bucket |
| `OUTPUT_TOPIC` | `tpc-invoice-classified-dev` | Next topic |

**data-extractor:**
| Key | Default | Description |
|-----|---------|-------------|
| `SOURCE_BUCKET` | `eda-gemini-dev-classified` | Input bucket |
| `DEST_BUCKET` | `eda-gemini-dev-extracted` | Output bucket |
| `OUTPUT_TOPIC` | `tpc-invoice-extracted-dev` | Next topic |
| `MODEL_ID` | `gemini-2.0-flash` | Gemini model |

**bigquery-writer:**
| Key | Default | Description |
|-----|---------|-------------|
| `SOURCE_BUCKET` | `eda-gemini-dev-extracted` | Input bucket |
| `ARCHIVE_BUCKET` | `eda-gemini-dev-archive` | Archive bucket |
| `DATASET_ID` | `ds_bq_gemini_dev` | BigQuery dataset |
| `TABLE_ID` | `tb_extractions` | Main table |

---

## Security Considerations

1. **No public access** - All buckets have public access prevention enabled
2. **Internal ingress only** - Cloud Run functions only accept internal traffic
3. **No unauthenticated access** - Functions require IAM authentication
4. **Least privilege IAM** - Each function has minimal required permissions
5. **Secrets in Secret Manager** - No hardcoded credentials
6. **Service account per function** - Isolation between function permissions
7. **Uniform bucket-level access** - No legacy ACLs

---

## Observability

| Aspect | Implementation |
|--------|----------------|
| **Logging** | Structured JSON to Cloud Logging with invoice_id, message_id, vendor_type |
| **Metrics** | Cloud Monitoring default Cloud Run metrics (request count, latency, errors) |
| **Tracing** | Not implemented in Phase 1 (add OpenTelemetry in Phase 2) |
| **Alerting** | Not implemented in Phase 1 (add in Phase 2 with CrewAI) |

---

## Deployment Sequence

```text
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ORDER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 1: Prerequisites (00-env-setup.sh, 01-enable-apis.sh)    │
│  ─────────────────────────────────────────────────────────────  │
│  1. Set environment variables                                    │
│  2. Enable GCP APIs                                              │
│  3. Create Artifact Registry repository                          │
│                                                                  │
│  Phase 2: Infrastructure (02-06 scripts)                        │
│  ─────────────────────────────────────────────────────────────  │
│  4. Create GCS buckets (no dependencies)                         │
│  5. Create Pub/Sub topics (no dependencies)                      │
│  6. Create BigQuery dataset + tables (no dependencies)           │
│  7. Create secrets (no dependencies)                             │
│  8. Create service accounts (depends on buckets, topics, BQ)     │
│  9. Grant IAM permissions                                        │
│                                                                  │
│  Phase 3: Functions (10-12 scripts)                              │
│  ─────────────────────────────────────────────────────────────  │
│  10. Build Docker images                                         │
│  11. Push to Artifact Registry                                   │
│  12. Deploy Cloud Run services (depends on SA, secrets)          │
│                                                                  │
│  Phase 4: Event Chain (13 script)                                │
│  ─────────────────────────────────────────────────────────────  │
│  13. Create GCS notification to Pub/Sub                          │
│  14. Create push subscriptions to Cloud Run                      │
│                                                                  │
│  Phase 5: Validation (20-21 scripts)                             │
│  ─────────────────────────────────────────────────────────────  │
│  15. Verify all resources exist                                  │
│  16. Run end-to-end test with synthetic TIFF                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | design-agent | Initial version |

---

## Next Step

**Ready for:** `/build .claude/sdd/features/DESIGN_GCP_PIPELINE_DEPLOYMENT.md`

This will implement:
1. All 49 files in the manifest
2. Infrastructure deployment scripts
3. 4 Cloud Run functions
4. Validation and testing scripts
