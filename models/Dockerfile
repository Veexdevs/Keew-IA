# Keew LM — servidor do modelo próprio da Keew IA
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    KEEW_THREADS=2 \
    PORT=8080

RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir tokenizers fastapi uvicorn numpy

COPY model.py serve.py ./
COPY tokenizer/ ./tokenizer/
COPY checkpoints/ ./checkpoints/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8080/health')"

CMD ["python", "serve.py"]
