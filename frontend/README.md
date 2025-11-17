# AI Document Processing Frontend

Quasar-based frontend for the AI Document Processing Wizard.

## Features

- Multi-step wizard interface
- File upload with drag & drop support
- AI model selection (Ollama, OpenAI, Anthropic, Gemini)
- Prompt templates for common tasks
- Processing options configuration
- Responsive design

## Development

### Install dependencies

```bash
npm install
```

### Start development server

```bash
npm run dev
```

The app will be available at http://localhost:9000

### Build for production

```bash
npm run build
```

### Lint files

```bash
npm run lint
```

## Docker

Build and run with Docker:

```bash
docker build -t dp-frontend .
docker run -p 80:80 dp-frontend
```

Or use docker-compose from the project root.

## Environment Variables

- `API_URL` - Backend API URL (default: http://localhost:3000/api/wizard)

## Project Structure

```
src/
├── App.vue          # Root component
├── boot/            # Boot files (axios, etc.)
├── components/      # Reusable components
├── css/             # Global styles
├── layouts/         # Layout components
├── pages/           # Page components
├── router/          # Vue Router configuration
└── stores/          # Pinia stores
```
