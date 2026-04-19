# Cloud q deploy

Turnkey recipe for hosting a shared Qanvas backend. One container runs:

1. a q process booted with `server/qanvas-boot.q` on an internal port
2. a Node websocket bridge that also serves the compiled web app

Point any Qanvas client at `wss://your-host/ws` (Settings → Cloud q) to use it.

```bash
# from repo root:
docker build -f deploy/docker-cloud-q/Dockerfile -t qanvas:latest .
docker run --rm -p 8080:8080 -v ~/.kx/kc.lic:/root/.kx/kc.lic:ro qanvas:latest
open http://localhost:8080
```

The Dockerfile intentionally does not bundle q itself — kdb+ is proprietary. Either use a kx-provided base image or COPY a q binary into the final stage.
