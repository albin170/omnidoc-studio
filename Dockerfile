# Production Container for Google Cloud Run & Docker
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY backend/ /app/

EXPOSE 8080

# Run Alembic migrations on startup, then launch Uvicorn on Cloud Run's $PORT
CMD sh -c "python -m alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"

