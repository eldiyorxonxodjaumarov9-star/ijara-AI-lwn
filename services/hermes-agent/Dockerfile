# syntax=docker/dockerfile:1
ARG HERMES_IMAGE=nousresearch/hermes-agent:latest
FROM ${HERMES_IMAGE}

COPY scripts /opt/hermes-arenda/scripts
COPY fixtures /opt/hermes-arenda/fixtures
COPY skills /opt/hermes-arenda/skills

ENV HERMES_HOME=/opt/data
ENV PYTHONUNBUFFERED=1
