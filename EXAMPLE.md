# Example Usage

This guide shows a complete example of using the Document Processing Wizard.

## Scenario

You have three financial documents:
- `Q4_Report.pdf` - Quarterly financial report
- `Revenue_Table.xlsx` - Revenue breakdown
- `Summary.docx` - Executive summary

You want to:
1. Extract all revenue figures
2. Update the revenue table with new values
3. Create a comprehensive 2025 summary

## Step-by-Step Example

### 1. Upload Files

```bash
curl -X POST http://localhost:3000/api/wizard/upload \
  -F "files=@Q4_Report.pdf" \
  -F "files=@Revenue_Table.xlsx" \
  -F "files=@Summary.docx" \
  -F "userId=user123" \
  -F 'metadata={"project":"2025-Planning","department":"Finance"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "abc-123-def-456",
    "files": [
      {
        "id": "file-1",
        "filename": "Q4_Report.pdf",
        "tokenCount": 2500,
        "sections": [
          { "title": "Executive Summary", "level": 1 },
          { "title": "Q4 Performance", "level": 1 },
          { "title": "Revenue Analysis", "level": 2 }
        ]
      },
      {
        "id": "file-2",
        "filename": "Revenue_Table.xlsx",
        "tokenCount": 800,
        "tables": [
          {
            "headers": ["Month", "Revenue", "Growth"],
            "rows": [["Oct", "50000", "5%"], ...]
          }
        ]
      },
      {
        "id": "file-3",
        "filename": "Summary.docx",
        "tokenCount": 1200
      }
    ],
    "tokenEstimate": {
      "total": 4500,
      "estimatedCost": 0.07,
      "recommendations": [
        "✓ Compatible with 15 models",
        "Recommended: GPT-3.5-turbo or Llama 3.1 (cost-effective)"
      ]
    },
    "canProcess": true
  }
}
```

**Save the sessionId:** `abc-123-def-456`

### 2. Submit Prompts

```bash
curl -X POST http://localhost:3000/api/wizard/prompts \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "abc-123-def-456",
    "prompts": [
      {
        "content": "Extrahuj všechny údaje o příjmech ze sekce Revenue Analysis",
        "priority": 1,
        "targetType": "SECTION_SPECIFIC",
        "targetSection": "Revenue Analysis"
      },
      {
        "content": "Aktualizuj tabulku příjmů s následujícími hodnotami: Říjen - 52000, Listopad - 54000, Prosinec - 51000",
        "priority": 2,
        "targetType": "FILE_SPECIFIC",
        "targetFileId": "file-2"
      },
      {
        "content": "Vytvoř komplexní shrnutí pro rok 2025 na základě všech dokumentů. Zahrň: 1) Celkové příjmy za Q4, 2) Trend růstu, 3) Projekce pro Q1 2025, 4) Doporučení",
        "priority": 3,
        "targetType": "GLOBAL"
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "prompts": [
      {
        "id": "prompt-1",
        "priority": 1,
        "executionOrder": 1
      },
      {
        "id": "prompt-2",
        "priority": 2,
        "executionOrder": 2
      },
      {
        "id": "prompt-3",
        "priority": 3,
        "executionOrder": 3
      }
    ],
    "estimatedTime": 30,
    "status": "queued"
  }
}
```

### 3. Monitor Processing

```bash
# Check status every few seconds
watch -n 2 curl -s http://localhost:3000/api/wizard/status/abc-123-def-456
```

**Response (while processing):**
```json
{
  "success": true,
  "data": {
    "status": "PROCESSING",
    "progress": 33,
    "prompts": {
      "total": 3,
      "completed": 1,
      "processing": 1,
      "pending": 1
    }
  }
}
```

**Response (processing complete):**
```json
{
  "success": true,
  "data": {
    "status": "PROCESSING",
    "progress": 100,
    "prompts": {
      "total": 3,
      "completed": 3,
      "processing": 0,
      "pending": 0
    },
    "hasClarifications": true,
    "clarificationCount": 1,
    "hasResult": true
  }
}
```

### 4. Handle Clarifications

AI detected some uncertainty and needs clarification:

```bash
curl http://localhost:3000/api/wizard/clarifications/abc-123-def-456
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clarifications": [
      {
        "id": "clarif-1",
        "question": "Našel jsem rozdíl mezi příjmy v PDF (157000) a v tabulce (155000). Kterou hodnotu mám použít pro shrnutí?",
        "context": {
          "promptId": "prompt-3",
          "pdfValue": "157000",
          "tableValue": "155000"
        }
      }
    ]
  }
}
```

**Respond to clarification:**
```bash
curl -X POST http://localhost:3000/api/wizard/clarifications/respond \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "abc-123-def-456",
    "clarificationId": "clarif-1",
    "response": "Použij hodnotu z PDF (157000), protože je to oficiální zpráva."
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "answered"
  }
}
```

After answering, the AI will continue processing with the clarification.

### 5. Get Result

```bash
curl http://localhost:3000/api/wizard/result/abc-123-def-456
```

**Response:**
```json
{
  "success": true,
  "data": {
    "result": {
      "id": "result-1",
      "version": 1,
      "content": "# Finanční shrnutí Q4 2024 a projekce Q1 2025\n\n## Celkové příjmy Q4 2024\n\n**Total Revenue:** 157,000 Kč\n\n| Měsíc | Příjmy | Růst |\n|-------|--------|------|\n| Říjen | 52,000 | 5% |\n| Listopad | 54,000 | 3.8% |\n| Prosinec | 51,000 | -5.5% |\n\n## Analýza trendu\n\nQ4 2024 ukázalo:\n- **Celkový růst:** 3.1% oproti Q3\n- **Nejsilnější měsíc:** Listopad (54,000)\n- **Pokles v prosinci:** -5.5% (sezónní efekt)\n\n## Projekce Q1 2025\n\nNa základě Q4 trendů a historických dat:\n\n| Měsíc | Projektované příjmy | Předpokládaný růst |\n|-------|---------------------|--------------------|\n| Leden | 53,000 | 4% |\n| Únor | 55,000 | 3.7% |\n| Březen | 58,000 | 5.4% |\n\n**Celkem Q1 2025 (projekce):** 166,000 Kč\n\n## Doporučení\n\n1. **Zaměřit se na růst v březnu**: Historicky nejsilnější měsíc Q1\n2. **Stabilizovat prosincový pokles**: Implementovat promo kampaně\n3. **Investice do marketingu**: 10% z Q4 příjmů do Q1 kampaní\n4. **Monitoring**: Týdenní kontrola oproti projekcím\n\n---\n\n*Vygenerováno: 2024-01-15*\n*Zdroje: Q4_Report.pdf, Revenue_Table.xlsx, Summary.docx*",
      "format": "markdown",
      "status": "PENDING_CONFIRMATION"
    }
  }
}
```

### 6a. Confirm Result (Happy Path)

Everything looks good, confirm it:

```bash
curl -X POST http://localhost:3000/api/wizard/result/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "abc-123-def-456",
    "resultId": "result-1",
    "action": "CONFIRM"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "confirmed",
    "message": "Document confirmed successfully"
  }
}
```

**Done!** ✅ Your document is finalized.

### 6b. Modify Result (Alternative Path)

You want to make some changes:

```bash
curl -X POST http://localhost:3000/api/wizard/result/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "abc-123-def-456",
    "resultId": "result-1",
    "action": "MODIFY"
  }'
```

Then submit modifications:

```bash
curl -X POST http://localhost:3000/api/wizard/result/modify \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "abc-123-def-456",
    "resultId": "result-1",
    "modifications": [
      {
        "content": "Přidej sekci s riziky a opatřeními pro Q1 2025",
        "priority": 1
      },
      {
        "content": "Vytvoř graf vývoje příjmů v ASCII formátu",
        "priority": 2
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "processing_modifications"
  }
}
```

Wait for processing, then get the new result:

```bash
curl http://localhost:3000/api/wizard/result/abc-123-def-456
```

**New version with modifications:**
```json
{
  "success": true,
  "data": {
    "result": {
      "id": "result-2",
      "version": 2,
      "content": "# Finanční shrnutí Q4 2024 a projekce Q1 2025\n\n...[previous content]...\n\n## Rizika a opatření Q1 2025\n\n### Identifikovaná rizika:\n\n1. **Ekonomická nejistota** (vysoká pravděpodobnost)\n   - Opatření: Diverzifikace zdrojů příjmů\n   \n2. **Sezónní výkyvy** (střední pravděpodobnost)\n   - Opatření: Vyrovnávací rezerva 15%\n   \n3. **Konkurence** (střední pravděpodobnost)\n   - Opatření: Zlepšení služeb zákazníkům\n\n## Vizualizace trendu příjmů\n\n```\nPříjmy (tis. Kč)\n60 ┤         ╭╮\n55 ┤      ╭──╯╰╮\n50 ┼──────╯    ╰─\n45 ┤\n   Q4 Oct Nov Dec Jan Feb Mar\n      └─ Q4 2024 ─┘└─ Q1 2025 ─┘\n```\n\n...",
      "format": "markdown",
      "status": "PENDING_CONFIRMATION",
      "version": 2
    }
  }
}
```

### 6c. Regenerate (Alternative Path)

Not happy with the result? Start over:

```bash
curl -X POST http://localhost:3000/api/wizard/result/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "abc-123-def-456",
    "resultId": "result-1",
    "action": "REGENERATE"
  }'
```

This will re-run all prompts from scratch with the AI.

## Complete Example Script

Here's a bash script that runs the entire workflow:

```bash
#!/bin/bash

# Configuration
API_URL="http://localhost:3000/api/wizard"

# 1. Upload files
echo "📤 Uploading files..."
UPLOAD_RESPONSE=$(curl -s -X POST $API_URL/upload \
  -F "files=@Q4_Report.pdf" \
  -F "files=@Revenue_Table.xlsx" \
  -F "files=@Summary.docx")

SESSION_ID=$(echo $UPLOAD_RESPONSE | jq -r '.data.sessionId')
echo "✓ Session created: $SESSION_ID"

# 2. Submit prompts
echo "📝 Submitting prompts..."
curl -s -X POST $API_URL/prompts \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"prompts\": [
      {
        \"content\": \"Extrahuj příjmy z Revenue Analysis\",
        \"priority\": 1,
        \"targetType\": \"SECTION_SPECIFIC\",
        \"targetSection\": \"Revenue Analysis\"
      },
      {
        \"content\": \"Vytvoř shrnutí pro 2025\",
        \"priority\": 2,
        \"targetType\": \"GLOBAL\"
      }
    ]
  }" > /dev/null

echo "✓ Prompts submitted"

# 3. Wait for processing
echo "⏳ Processing..."
while true; do
  STATUS=$(curl -s $API_URL/status/$SESSION_ID | jq -r '.data.status')
  PROGRESS=$(curl -s $API_URL/status/$SESSION_ID | jq -r '.data.progress')
  echo "   Status: $STATUS ($PROGRESS%)"

  if [ "$PROGRESS" = "100" ]; then
    break
  fi

  sleep 2
done

# 4. Check for clarifications
CLARIF_COUNT=$(curl -s $API_URL/clarifications/$SESSION_ID | jq -r '.data.clarifications | length')
if [ "$CLARIF_COUNT" != "0" ]; then
  echo "❓ $CLARIF_COUNT clarifications pending"
  # Handle clarifications here
fi

# 5. Get result
echo "📄 Fetching result..."
RESULT=$(curl -s $API_URL/result/$SESSION_ID)
RESULT_ID=$(echo $RESULT | jq -r '.data.result.id')
CONTENT=$(echo $RESULT | jq -r '.data.result.content')

# Save to file
echo "$CONTENT" > result.md
echo "✓ Result saved to result.md"

# 6. Confirm
echo "✅ Confirming result..."
curl -s -X POST $API_URL/result/confirm \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"resultId\": \"$RESULT_ID\",
    \"action\": \"CONFIRM\"
  }" > /dev/null

echo "✓ Done! Document confirmed."
```

## Tips

1. **Session expires after 1 hour** - Complete your workflow within the time limit or extend the session
2. **Monitor progress** - Use the status endpoint to track processing
3. **Handle clarifications promptly** - AI will wait for your response
4. **Use appropriate targeting** - FILE_SPECIFIC is faster than GLOBAL for targeted tasks
5. **Set priorities wisely** - Lower priority number = executes first
6. **Save sessionId** - You'll need it for all subsequent operations

## Next Steps

- Integrate this workflow into your frontend
- Add error handling
- Implement real-time updates with polling or WebSockets
- Add user authentication
- Customize AI prompts for your use case
