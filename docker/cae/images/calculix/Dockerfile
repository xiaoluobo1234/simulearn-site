# CalculiX Docker image for FEM solving
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    calculix-ccx \
    && rm -rf /var/lib/apt/lists/*

# Verify installation
RUN ccx -v 2>&1 || true

ENTRYPOINT ["ccx"]
CMD ["-h"]
