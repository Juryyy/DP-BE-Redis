# MarkItDown PDF Parser Service

A Dockerized Python microservice for parsing PDFs and other documents using Microsoft's MarkItDown library.

## Overview

This service provides a REST API for converting documents (PDF, DOCX, XLSX, images, etc.) to Markdown format using the [MarkItDown](https://github.com/microsoft/markitdown) library from Microsoft.

## Features

- **Multiple format support**: PDF, DOCX, XLSX, PPTX, images (PNG, JPG), HTML, and more
- **Markdown output**: Clean, structured Markdown with preserved formatting
- **Metadata extraction**: File metadata, creation dates, authors, etc.
- **Table detection**: Automatic table extraction and formatting
- **RESTful API**: Simple HTTP endpoints for document processing
- **Dockerized**: Easy deployment with Docker/Docker Compose

## API Endpoints

### POST /parse
Parse a document and return Markdown content.

**Request:**
```bash
curl -X POST -F "file=@document.pdf" http://localhost:5000/parse
```

**Response:**
```json
{
  "success": true,
  "data": {
    "markdown": "# Document Title\n\nContent here...",
    "metadata": {
      "filename": "document.pdf",
      "size": 524288,
      "mimeType": "application/pdf",
      "createdDate": "2024-01-15T10:30:00Z",
      "modifiedDate": "2024-01-15T10:30:00Z",
      "author": "John Doe",
      "pages": 10
    },
    "warnings": []
  }
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "markitdown-parser",
  "version": "1.0.0"
}
```

## Installation

### Using Docker (Recommended)

1. **Build the Docker image:**
```bash
docker build -t markitdown-parser .
```

2. **Run the container:**
```bash
docker run -p 5000:5000 markitdown-parser
```

3. **Or use Docker Compose:**
```bash
docker-compose up -d
```

### Local Development

1. **Install Python 3.11+:**
```bash
python --version  # Should be 3.11 or higher
```

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

3. **Run the service:**
```bash
python app.py
```

The service will be available at `http://localhost:5000`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | `5000` |
| `MAX_FILE_SIZE` | Maximum file size (bytes) | `52428800` (50MB) |
| `UPLOAD_FOLDER` | Temporary upload directory | `/tmp/uploads` |
| `LOG_LEVEL` | Logging level | `INFO` |

## Integration with Main Backend

### Option 1: Sidecar Service (Docker Compose)

Add to your main `docker-compose.yml`:

```yaml
services:
  markitdown:
    build: ./markitdown-parser
    ports:
      - "5000:5000"
    environment:
      - MAX_FILE_SIZE=52428800
    volumes:
      - ./uploads:/tmp/uploads
    networks:
      - backend

  backend:
    # Your existing backend service
    depends_on:
      - markitdown
    environment:
      - MARKITDOWN_URL=http://markitdown:5000
```

### Option 2: Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: markitdown-parser
spec:
  replicas: 2
  selector:
    matchLabels:
      app: markitdown-parser
  template:
    metadata:
      labels:
        app: markitdown-parser
    spec:
      containers:
      - name: markitdown
        image: markitdown-parser:latest
        ports:
        - containerPort: 5000
        env:
        - name: MAX_FILE_SIZE
          value: "52428800"
```

### Option 3: Standalone Service

Run as a separate microservice and call it from your Node.js backend:

```typescript
// In your Node.js backend
const response = await axios.post('http://markitdown-service:5000/parse', formData, {
  headers: formData.getHeaders(),
});
const { markdown, metadata } = response.data.data;
```

## Features Comparison

| Feature | Current Parser | MarkItDown Parser |
|---------|---------------|-------------------|
| PDF text extraction | ✓ (pdf-parse) | ✓ (Better quality) |
| PDF table detection | Basic | Advanced |
| PDF image extraction | ✗ | ✓ |
| DOCX parsing | ✓ (mammoth) | ✓ (Better formatting) |
| XLSX parsing | ✓ | ✓ |
| PowerPoint | ✗ | ✓ |
| Images (OCR) | ✗ | ✓ |
| HTML | ✗ | ✓ |
| Markdown output | ✓ | ✓ (Native) |
| Metadata extraction | Partial | Complete |

## Date Handling

The parser handles missing or invalid dates gracefully:

- **Missing creation date**: Falls back to file system metadata
- **Invalid dates**: Uses current timestamp with warning
- **Timezone handling**: All dates normalized to UTC ISO 8601 format
- **Custom date detection**: Extracts dates from document headers/footers

## Error Handling

The service provides detailed error messages:

```json
{
  "success": false,
  "error": {
    "code": "PARSE_ERROR",
    "message": "Failed to parse PDF: Invalid PDF structure",
    "details": {
      "filename": "document.pdf",
      "stage": "pdf_extraction"
    }
  }
}
```

## Performance

- **Average parsing time**: 1-3 seconds for typical PDFs (10-50 pages)
- **Memory usage**: ~200MB base + ~5MB per concurrent request
- **Concurrency**: Handles 10+ concurrent requests (configurable)

## Security

- **File size limits**: Enforced at 50MB (configurable)
- **MIME type validation**: Whitelist of allowed file types
- **Temporary file cleanup**: Automatic cleanup after processing
- **No persistent storage**: Files deleted immediately after parsing

## Monitoring

Health check endpoint for monitoring:

```bash
curl http://localhost:5000/health
```

## Troubleshooting

### "Failed to parse PDF"
- Check if the PDF is password-protected
- Verify PDF is not corrupted
- Increase MAX_FILE_SIZE if file is large

### "Service timeout"
- Large files may take longer to process
- Increase request timeout in your client
- Consider async processing for large files

### "Missing dependencies"
- Ensure all system dependencies are installed (see Dockerfile)
- Rebuild Docker image if using outdated version

## Roadmap

- [ ] Async processing with job queue
- [ ] Batch processing support
- [ ] Custom template support for Markdown output
- [ ] Image optimization and compression
- [ ] Export to multiple formats (HTML, JSON, etc.)
- [ ] OCR improvements for scanned documents

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [Your repository]
- Documentation: [Link to docs]
