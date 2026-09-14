# syntax=docker/dockerfile:1
FROM python:3.11-slim-bookworm

RUN useradd --create-home --uid 10001 hermes \
  && apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/hermes-arenda
COPY scripts/healthcheck.py /opt/hermes-arenda/scripts/healthcheck.py
COPY fixtures /opt/hermes-arenda/fixtures
COPY skills /opt/hermes-arenda/skills

ENV HERMES_HOME=/var/lib/hermes
ENV PYTHONUNBUFFERED=1

USER hermes
# Official Hermes install is performed at container start or bake step on host.
# Image does not embed secrets or DATABASE_URL.

HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD python /opt/hermes-arenda/scripts/healthcheck.py

CMD ["python", "/opt/hermes-arenda/scripts/healthcheck.py", "--loop"]
