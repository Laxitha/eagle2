FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
RUN python -m spacy download en_core_web_lg

COPY backend/app backend/app
COPY nlp nlp

ENV PYTHONPATH=/app/backend

WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
