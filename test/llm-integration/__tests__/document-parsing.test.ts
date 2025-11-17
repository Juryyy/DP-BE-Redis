import * as fs from 'fs';
import * as path from 'path';

const SAMPLES_DIR = path.join(__dirname, '..', 'samples');

describe('Sample Document Files', () => {
  describe('File Existence and Format', () => {
    test('PDF invoice file exists', () => {
      const pdfPath = path.join(SAMPLES_DIR, 'invoice-czech.pdf');
      expect(fs.existsSync(pdfPath)).toBe(true);
    });

    test('Excel technical report exists', () => {
      const xlsxPath = path.join(SAMPLES_DIR, 'technical-report.xlsx');
      expect(fs.existsSync(xlsxPath)).toBe(true);
    });

    test('Word meeting notes exists', () => {
      const docxPath = path.join(SAMPLES_DIR, 'meeting-notes.docx');
      expect(fs.existsSync(docxPath)).toBe(true);
    });

    test('PDF file has correct magic bytes', () => {
      const pdfPath = path.join(SAMPLES_DIR, 'invoice-czech.pdf');
      const buffer = fs.readFileSync(pdfPath);
      const header = buffer.slice(0, 4).toString();
      expect(header).toBe('%PDF');
    });

    test('Excel file has correct magic bytes (ZIP format)', () => {
      const xlsxPath = path.join(SAMPLES_DIR, 'technical-report.xlsx');
      const buffer = fs.readFileSync(xlsxPath);
      // XLSX files are ZIP archives, start with PK (0x504B)
      expect(buffer[0]).toBe(0x50); // P
      expect(buffer[1]).toBe(0x4b); // K
    });

    test('Word file has correct magic bytes (ZIP format)', () => {
      const docxPath = path.join(SAMPLES_DIR, 'meeting-notes.docx');
      const buffer = fs.readFileSync(docxPath);
      // DOCX files are ZIP archives, start with PK
      expect(buffer[0]).toBe(0x50); // P
      expect(buffer[1]).toBe(0x4b); // K
    });
  });

  describe('File Size Validation', () => {
    test('PDF file has reasonable size', () => {
      const pdfPath = path.join(SAMPLES_DIR, 'invoice-czech.pdf');
      const stats = fs.statSync(pdfPath);

      // Should be at least 1KB and less than 10MB
      expect(stats.size).toBeGreaterThan(1024);
      expect(stats.size).toBeLessThan(10 * 1024 * 1024);
    });

    test('Excel file has reasonable size', () => {
      const xlsxPath = path.join(SAMPLES_DIR, 'technical-report.xlsx');
      const stats = fs.statSync(xlsxPath);

      expect(stats.size).toBeGreaterThan(1024);
      expect(stats.size).toBeLessThan(10 * 1024 * 1024);
    });

    test('Word file has reasonable size', () => {
      const docxPath = path.join(SAMPLES_DIR, 'meeting-notes.docx');
      const stats = fs.statSync(docxPath);

      expect(stats.size).toBeGreaterThan(1024);
      expect(stats.size).toBeLessThan(10 * 1024 * 1024);
    });
  });
});

describe('Test Case Configuration Files', () => {
  const singleModelDir = path.join(__dirname, '..', 'single-model');
  const multiModelDir = path.join(__dirname, '..', 'multi-model');

  describe('Single-Model Test Cases', () => {
    const testFiles = [
      'test-01-invoice-extraction.json',
      'test-02-technical-analysis.json',
      'test-03-meeting-summarization.json',
    ];

    testFiles.forEach(file => {
      test(`${file} should be valid JSON`, () => {
        const filePath = path.join(singleModelDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        expect(() => JSON.parse(content)).not.toThrow();
      });

      test(`${file} should have required fields`, () => {
        const filePath = path.join(singleModelDir, file);
        const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        expect(config).toHaveProperty('testId');
        expect(config).toHaveProperty('testName');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('sampleFile');
        expect(config).toHaveProperty('provider');
        expect(config).toHaveProperty('prompts');
      });

      test(`${file} should have valid provider`, () => {
        const filePath = path.join(singleModelDir, file);
        const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        const validProviders = ['openai', 'anthropic', 'gemini', 'ollama', 'ollama-remote'];
        expect(validProviders).toContain(config.provider);
      });

      test(`${file} should have valid temperature`, () => {
        const filePath = path.join(singleModelDir, file);
        const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        if (config.temperature !== undefined) {
          expect(config.temperature).toBeGreaterThanOrEqual(0);
          expect(config.temperature).toBeLessThanOrEqual(2);
        }
      });

      test(`${file} should have valid maxTokens`, () => {
        const filePath = path.join(singleModelDir, file);
        const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        if (config.maxTokens !== undefined) {
          expect(config.maxTokens).toBeGreaterThan(0);
          expect(config.maxTokens).toBeLessThanOrEqual(100000);
        }
      });

      test(`${file} prompts should have content`, () => {
        const filePath = path.join(singleModelDir, file);
        const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        expect(Array.isArray(config.prompts)).toBe(true);
        expect(config.prompts.length).toBeGreaterThan(0);

        config.prompts.forEach((prompt: any) => {
          expect(prompt).toHaveProperty('content');
          expect(prompt.content.length).toBeGreaterThan(10);
        });
      });

      test(`${file} sample file should exist`, () => {
        const filePath = path.join(singleModelDir, file);
        const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        const samplePath = path.join(singleModelDir, config.sampleFile);
        expect(fs.existsSync(samplePath)).toBe(true);
      });
    });
  });

  describe('Multi-Model Test Cases', () => {
    const testFiles = [
      'test-01-invoice-comparison.json',
      'test-02-technical-summary.json',
      'test-03-action-items-extraction.json',
    ];

    testFiles.forEach(file => {
      test(`${file} should be valid JSON`, () => {
        const filePath = path.join(multiModelDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        expect(() => JSON.parse(content)).not.toThrow();
      });

      test(`${file} should have required fields`, () => {
        const filePath = path.join(multiModelDir, file);
        const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        expect(config).toHaveProperty('testId');
        expect(config).toHaveProperty('testName');
        expect(config).toHaveProperty('sampleFile');
        expect(config).toHaveProperty('prompt');
        expect(config).toHaveProperty('models');
      });

      test(`${file} should have multiple models`, () => {
        const filePath = path.join(multiModelDir, file);
        const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        expect(Array.isArray(config.models)).toBe(true);
        expect(config.models.length).toBeGreaterThan(1);
      });

      test(`${file} models should have valid providers`, () => {
        const filePath = path.join(multiModelDir, file);
        const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        const validProviders = ['openai', 'anthropic', 'gemini', 'ollama', 'ollama-remote'];

        config.models.forEach((model: any) => {
          expect(model).toHaveProperty('provider');
          expect(validProviders).toContain(model.provider);
        });
      });

      test(`${file} models should have enabled flag`, () => {
        const filePath = path.join(multiModelDir, file);
        const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        config.models.forEach((model: any) => {
          expect(model).toHaveProperty('enabled');
          expect(typeof model.enabled).toBe('boolean');
        });
      });

      test(`${file} should have comparison criteria`, () => {
        const filePath = path.join(multiModelDir, file);
        const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        expect(config).toHaveProperty('comparisonCriteria');
        expect(typeof config.comparisonCriteria).toBe('object');
        expect(Object.keys(config.comparisonCriteria).length).toBeGreaterThan(0);
      });

      test(`${file} sample file should exist`, () => {
        const filePath = path.join(multiModelDir, file);
        const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        const samplePath = path.join(multiModelDir, config.sampleFile);
        expect(fs.existsSync(samplePath)).toBe(true);
      });
    });
  });
});

describe('Prompt Content Validation', () => {
  const singleModelDir = path.join(__dirname, '..', 'single-model');

  test('prompts should be in Czech language', () => {
    const files = fs.readdirSync(singleModelDir).filter(f => f.endsWith('.json'));

    files.forEach(file => {
      const config = JSON.parse(fs.readFileSync(path.join(singleModelDir, file), 'utf-8'));

      config.prompts.forEach((prompt: any) => {
        // Check for Czech characters or common Czech words
        const hasCzechContent =
          /[áčďéěíňóřšťúůýž]/i.test(prompt.content) ||
          /\b(nebo|podle|které|jejich|všechny|informace)\b/i.test(prompt.content);

        expect(hasCzechContent).toBe(true);
      });
    });
  });

  test('prompts should be reasonably long', () => {
    const singleModelDir = path.join(__dirname, '..', 'single-model');
    const files = fs.readdirSync(singleModelDir).filter(f => f.endsWith('.json'));

    files.forEach(file => {
      const config = JSON.parse(fs.readFileSync(path.join(singleModelDir, file), 'utf-8'));

      config.prompts.forEach((prompt: any) => {
        // Prompt should be at least 50 characters but not too long
        expect(prompt.content.length).toBeGreaterThan(50);
        expect(prompt.content.length).toBeLessThan(5000);
      });
    });
  });
});
