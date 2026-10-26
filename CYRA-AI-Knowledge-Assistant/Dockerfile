# Production Dockerfile for AICTE Regulatory RAG Assistant (CYRA Backend)
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Prevent Python from writing .pyc and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LOW_MEMORY=true \
    FAST_EMBEDDING=true \
    FAST_LLM=true \
    PROJECT_ID=aicte \
    PROJECT_SCOPE=aicte \
    PORT=7861

# Install system dependencies (Tesseract OCR for document inspection)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    tesseract-ocr \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and regulatory corpus
COPY backend/ ./backend/
COPY corpus/ ./corpus/
COPY .env.example .env

# Pre-ingest AICTE Approval Process Handbook PDFs into local Qdrant collection
RUN python -m backend.ingestion.run --reset

# Expose service port
EXPOSE 7861

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT}/healthz || exit 1

# Start FastAPI application with single worker for memory efficiency
CMD uvicorn backend.app:app --host 0.0.0.0 --port ${PORT} --workers 1
