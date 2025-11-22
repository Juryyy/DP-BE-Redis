#!/bin/bash

# LLM Integration Test Runner
# Tests single-model and multi-model API integrations

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000/api}"
RESULTS_DIR="./results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
VERBOSE=${VERBOSE:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "$RESULTS_DIR"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if API is running
check_api_health() {
    log_info "Checking API health..."

    if curl -s -f "$API_BASE_URL/admin/ollama/health" > /dev/null 2>&1; then
        log_success "API is running at $API_BASE_URL"
        return 0
    else
        log_error "API is not accessible at $API_BASE_URL"
        log_info "Please start the API server first: npm run dev"
        return 1
    fi
}

# Get available models configuration
get_model_config() {
    log_info "Fetching multi-model configuration..."
    curl -s "$API_BASE_URL/wizard/multi-model/config" | jq .
}

# Run single-model test via wizard flow
run_single_model_test() {
    local test_file=$1
    local test_name=$(jq -r '.testName' "$test_file")
    local provider=$(jq -r '.provider' "$test_file")
    local model=$(jq -r '.model' "$test_file")
    local sample_file=$(jq -r '.sampleFile' "$test_file")

    log_info "Running single-model test: $test_name"
    log_info "Provider: $provider, Model: $model"

    # Read the sample file content
    local sample_path="$(dirname "$test_file")/$sample_file"
    if [[ ! -f "$sample_path" ]]; then
        log_error "Sample file not found: $sample_path"
        return 1
    fi

    local content=$(cat "$sample_path")
    local prompt=$(jq -r '.prompts[0].content' "$test_file")
    local temperature=$(jq -r '.temperature' "$test_file")
    local max_tokens=$(jq -r '.maxTokens' "$test_file")

    # Build the multi-model execute request (single model)
    local request_body=$(jq -n \
        --arg prompt "$prompt" \
        --arg content "$content" \
        --arg provider "$provider" \
        --arg model "$model" \
        --argjson temperature "$temperature" \
        --argjson maxTokens "$max_tokens" \
        '{
            prompt: ("Kontext dokumentu:\n\n" + $content + "\n\n---\n\nÚkol: " + $prompt),
            models: [{
                provider: $provider,
                model: $model,
                temperature: $temperature,
                maxTokens: $maxTokens,
                enabled: true
            }]
        }')

    local result_file="$RESULTS_DIR/single_${provider}_${TIMESTAMP}.json"

    log_info "Sending request to multi-model execute endpoint..."
    local start_time=$(date +%s.%N)

    local response=$(curl -s -X POST "$API_BASE_URL/wizard/multi-model/execute" \
        -H "Content-Type: application/json" \
        -d "$request_body")

    local end_time=$(date +%s.%N)
    local elapsed=$(echo "$end_time - $start_time" | bc)

    # Save result
    echo "$response" | jq --arg elapsed "$elapsed" --arg test "$test_name" \
        '. + {testName: $test, totalElapsedTime: $elapsed}' > "$result_file"

    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        log_success "Test completed in ${elapsed}s"
        log_info "Result saved to: $result_file"

        if [[ "$VERBOSE" == "true" ]]; then
            echo "Response preview:"
            echo "$response" | jq '.data.results[0].content' | head -20
        fi
    else
        log_error "Test failed"
        echo "$response" | jq .
    fi

    echo ""
}

# Run multi-model comparison test
run_multi_model_test() {
    local test_file=$1
    local test_name=$(jq -r '.testName' "$test_file")
    local sample_file=$(jq -r '.sampleFile' "$test_file")

    log_info "Running multi-model test: $test_name"

    # Read the sample file content
    local sample_path="$(dirname "$test_file")/$sample_file"
    if [[ ! -f "$sample_path" ]]; then
        log_error "Sample file not found: $sample_path"
        return 1
    fi

    local content=$(cat "$sample_path")
    local prompt=$(jq -r '.prompt' "$test_file")
    local system_prompt=$(jq -r '.systemPrompt' "$test_file")
    local models=$(jq '.models' "$test_file")

    # Count enabled models
    local enabled_count=$(echo "$models" | jq '[.[] | select(.enabled == true)] | length')
    log_info "Testing with $enabled_count enabled models"

    # Build request
    local request_body=$(jq -n \
        --arg prompt "$prompt" \
        --arg content "$content" \
        --arg systemPrompt "$system_prompt" \
        --argjson models "$models" \
        '{
            prompt: ("Kontext dokumentu:\n\n" + $content + "\n\n---\n\nÚkol: " + $prompt),
            systemPrompt: $systemPrompt,
            models: $models
        }')

    local test_id=$(jq -r '.testId' "$test_file")
    local result_file="$RESULTS_DIR/multi_${test_id}_${TIMESTAMP}.json"

    log_info "Sending request to multi-model execute endpoint..."
    local start_time=$(date +%s.%N)

    local response=$(curl -s -X POST "$API_BASE_URL/wizard/multi-model/execute" \
        -H "Content-Type: application/json" \
        -d "$request_body")

    local end_time=$(date +%s.%N)
    local elapsed=$(echo "$end_time - $start_time" | bc)

    # Save result
    echo "$response" | jq --arg elapsed "$elapsed" --arg test "$test_name" \
        '. + {testName: $test, totalElapsedTime: $elapsed}' > "$result_file"

    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        log_success "Test completed in ${elapsed}s"
        log_info "Result saved to: $result_file"

        # Show summary
        echo ""
        echo "=== Model Response Summary ==="
        echo "$response" | jq -r '.data.results[] | "Provider: \(.provider), Model: \(.model), Time: \(.executionTime)ms, Status: \(.status)"'

        # Get comparison
        log_info "Generating comparison matrix..."
        local results=$(echo "$response" | jq '.data.results')
        local compare_response=$(curl -s -X POST "$API_BASE_URL/wizard/multi-model/compare" \
            -H "Content-Type: application/json" \
            -d "{\"results\": $results}")

        echo ""
        echo "=== Comparison Results ==="
        echo "$compare_response" | jq -r '.data | "Fastest: \(.fastestResult.provider) (\(.fastestResult.executionTime)ms)\nConsensus available: \(.consensusResult != null)"'

        # Save comparison
        local compare_file="$RESULTS_DIR/multi_${test_id}_compare_${TIMESTAMP}.json"
        echo "$compare_response" > "$compare_file"
        log_info "Comparison saved to: $compare_file"
    else
        log_error "Test failed"
        echo "$response" | jq .
    fi

    echo ""
}

# Test specific provider directly
test_provider_direct() {
    local provider=$1
    local prompt=$2

    log_info "Direct test for provider: $provider"

    local model=""
    case $provider in
        openai)
            model="gpt-4-turbo-preview"
            ;;
        anthropic)
            model="claude-3-5-sonnet-20241022"
            ;;
        gemini)
            model="gemini-1.5-pro"
            ;;
        ollama)
            model="llama3.1:8b"
            ;;
        ollama-remote)
            model="llama3.1:8b"
            ;;
        *)
            log_error "Unknown provider: $provider"
            return 1
            ;;
    esac

    local request_body=$(jq -n \
        --arg prompt "$prompt" \
        --arg provider "$provider" \
        --arg model "$model" \
        '{
            prompt: $prompt,
            models: [{
                provider: $provider,
                model: $model,
                temperature: 0.3,
                maxTokens: 1000,
                enabled: true
            }]
        }')

    local start_time=$(date +%s.%N)
    local response=$(curl -s -X POST "$API_BASE_URL/wizard/multi-model/execute" \
        -H "Content-Type: application/json" \
        -d "$request_body")
    local end_time=$(date +%s.%N)
    local elapsed=$(echo "$end_time - $start_time" | bc)

    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        log_success "$provider responded in ${elapsed}s"
        echo "$response" | jq -r '.data.results[0].content' | head -10
    else
        log_error "$provider test failed"
        echo "$response" | jq -r '.error // .message // "Unknown error"'
    fi
    echo ""
}

# Main menu
show_help() {
    echo "LLM Integration Test Runner"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  health              Check API health"
    echo "  config              Show multi-model configuration"
    echo "  single <test_file>  Run a single-model test"
    echo "  multi <test_file>   Run a multi-model comparison test"
    echo "  all-single          Run all single-model tests"
    echo "  all-multi           Run all multi-model tests"
    echo "  all                 Run all tests"
    echo "  test-provider <provider> <prompt>  Test a specific provider directly"
    echo "  quick               Quick test all configured providers"
    echo ""
    echo "Environment variables:"
    echo "  API_BASE_URL   Base URL for the API (default: http://localhost:3000/api)"
    echo "  VERBOSE        Show verbose output (default: false)"
    echo ""
    echo "Examples:"
    echo "  $0 health"
    echo "  $0 single ./single-model/test-01-invoice-extraction.json"
    echo "  $0 multi ./multi-model/test-01-invoice-comparison.json"
    echo "  $0 all-single"
    echo "  $0 test-provider openai \"Řekni ahoj v češtině\""
    echo "  VERBOSE=true $0 all"
}

quick_provider_test() {
    log_info "Quick test of all configured providers"
    echo ""

    local test_prompt="Odpověz jednou větou: Jaký je hlavní účel programovacího jazyka Python?"

    for provider in openai anthropic gemini ollama; do
        test_provider_direct "$provider" "$test_prompt"
    done
}

run_all_single_tests() {
    log_info "Running all single-model tests..."

    for test_file in ./single-model/test-*.json; do
        if [[ -f "$test_file" ]]; then
            run_single_model_test "$test_file"
        fi
    done
}

run_all_multi_tests() {
    log_info "Running all multi-model tests..."

    for test_file in ./multi-model/test-*.json; do
        if [[ -f "$test_file" ]]; then
            run_multi_model_test "$test_file"
        fi
    done
}

# Main execution
cd "$(dirname "$0")"

case "${1:-help}" in
    health)
        check_api_health
        ;;
    config)
        get_model_config
        ;;
    single)
        if [[ -z "$2" ]]; then
            log_error "Please specify a test file"
            exit 1
        fi
        check_api_health && run_single_model_test "$2"
        ;;
    multi)
        if [[ -z "$2" ]]; then
            log_error "Please specify a test file"
            exit 1
        fi
        check_api_health && run_multi_model_test "$2"
        ;;
    all-single)
        check_api_health && run_all_single_tests
        ;;
    all-multi)
        check_api_health && run_all_multi_tests
        ;;
    all)
        check_api_health && run_all_single_tests && run_all_multi_tests
        ;;
    test-provider)
        if [[ -z "$2" ]] || [[ -z "$3" ]]; then
            log_error "Please specify provider and prompt"
            exit 1
        fi
        check_api_health && test_provider_direct "$2" "$3"
        ;;
    quick)
        check_api_health && quick_provider_test
        ;;
    *)
        show_help
        ;;
esac
