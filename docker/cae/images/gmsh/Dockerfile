# Gmsh Docker image for mesh generation
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gmsh \
    && rm -rf /var/lib/apt/lists/*

# Verify installation
RUN gmsh --version

ENTRYPOINT ["gmsh"]
CMD ["--help"]
