# AI Document Processing Frontend

Quasar-based frontend for the AI Document Processing Wizard.

## Features

- Multi-step wizard interface using Quasar components
- File upload with drag & drop (Q-Uploader)
- AI model selection (Ollama, OpenAI, Anthropic, Gemini)
- Prompt templates for common tasks
- Processing options configuration
- Responsive design with Quasar Material Design components

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
├── App.vue                # Root component
├── boot/                  # Boot files (axios, etc.)
│   └── axios.ts           # API client configuration
├── components/            # Reusable components
│   └── wizard/            # Wizard-specific components
│       ├── FileUploader.vue
│       ├── ModelSelector.vue
│       ├── PromptInput.vue
│       ├── ProcessingOptions.vue
│       └── WizardStepper.vue
├── css/                   # Global styles
│   └── app.scss
├── layouts/               # Layout components
│   └── MainLayout.vue
├── pages/                 # Page components
│   ├── WizardPage.vue
│   └── ErrorNotFound.vue
├── router/                # Vue Router configuration
│   ├── index.ts
│   └── routes.ts
└── stores/                # Pinia stores
    ├── index.ts
    └── wizard-store.ts
```

## Key Components

### WizardStepper
Q-Stepper based navigation with 4 steps.

### FileUploader
Uses Q-Uploader with:
- Drag & drop support
- File type and size validation
- Progress tracking
- File list with type-specific icons

### ModelSelector
Provider and model selection with:
- Q-Btn-Toggle for provider switching
- Q-Option-Group for model selection
- Q-Expansion-Item for advanced options (temperature, max tokens, top-p)

### PromptInput
Prompt configuration with:
- Quick template buttons
- Q-Input textarea for custom prompts
- File list display with Q-Chip

### ProcessingOptions
Processing configuration with:
- Q-Radio groups for mode and format
- Q-Checkbox for additional settings
- Summary table with Q-Markup-Table
