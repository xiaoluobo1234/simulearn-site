# Python Sandbox for AI Agent code execution
# Runs user/AI-generated Python code in an isolated environment
FROM python:3.12-slim

WORKDIR /sandbox

# Install scientific packages needed by AI-generated code
RUN pip install --no-cache-dir \
    numpy \
    meshio \
    matplotlib \
    restrictedpython

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash sandbox
USER sandbox

# The sandbox runner will be mounted/copied at runtime
COPY sandbox_runner.py /sandbox/runner.py

ENTRYPOINT ["python", "/sandbox/runner.py"]
