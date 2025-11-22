# Quick Start: Pull a Model

You have two options to get started:

## Option 1: Using Docker Exec (Recommended)

```bash
# Pull mistral (fast, 4GB)
docker exec -it dp-ollama ollama pull mistral:latest

# OR pull llama3.2 (faster, 2GB)
docker exec -it dp-ollama ollama pull llama3.2:latest

# OR pull a larger model like llama3.1 (5GB)
docker exec -it dp-ollama ollama pull llama3.1:8b
```

## Option 2: Using the API

```bash
# Pull mistral
curl -X POST http://localhost:3000/api/admin/models/pull \
  -H "Content-Type: application/json" \
  -d '{"modelName": "mistral:latest"}'

# Then sync to database
curl -X POST http://localhost:3000/api/admin/models/sync
```

## Popular Models

| Model | Size | Speed | Quality | Command |
|-------|------|-------|---------|---------|
| **llama3.2** | 2GB | ⚡⚡⚡ | ⭐⭐⭐ | `ollama pull llama3.2` |
| **mistral** | 4GB | ⚡⚡ | ⭐⭐⭐⭐ | `ollama pull mistral:latest` |
| **llama3.1:8b** | 5GB | ⚡⚡ | ⭐⭐⭐⭐ | `ollama pull llama3.1:8b` |
| **gemma2:9b** | 5GB | ⚡⚡ | ⭐⭐⭐⭐ | `ollama pull gemma2:9b` |
| **phi3** | 2GB | ⚡⚡⚡ | ⭐⭐⭐ | `ollama pull phi3` |

## After Pulling

1. Restart the API: `docker-compose restart api`
2. The frontend will automatically detect the new models
3. Start processing!

## Check What's Available

```bash
# List models in Ollama
docker exec -it dp-ollama ollama list

# Check via API
curl http://localhost:3000/api/admin/models/available
```
