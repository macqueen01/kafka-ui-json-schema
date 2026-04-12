# Deployment Guide

## Switch kafka-ui to custom image

The GitLab CI pipeline builds and pushes the Docker image on every push to master.

**Image**: `registry.point3.io/point3/kafka-ui-json-schema:latest`

### Helm upgrade command

```bash
helm upgrade kafka-ui kafka-ui/kafka-ui \
  --namespace default \
  --reuse-values \
  --set image.registry=registry.point3.io \
  --set image.repository=point3/kafka-ui-json-schema \
  --set image.tag=latest
```

### Or with values file

Create `custom-values.yaml`:

```yaml
image:
  registry: registry.point3.io
  repository: point3/kafka-ui-json-schema
  tag: latest
```

Then:

```bash
helm upgrade kafka-ui kafka-ui/kafka-ui \
  --namespace default \
  --reuse-values \
  -f custom-values.yaml
```

### Pin to a specific build

Replace `latest` with the 8-character commit SHA shown in the GitLab pipeline:

```bash
--set image.tag=a1b2c3d4
```

### To revert to official image

```bash
helm upgrade kafka-ui kafka-ui/kafka-ui \
  --namespace default \
  --reuse-values \
  --set image.registry=docker.io \
  --set image.repository=provectuslabs/kafka-ui \
  --set image.tag=v0.7.2
```
