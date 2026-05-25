#!/bin/bash
# Setup script for Dutch Tutor

set -e
cd "$(dirname "$0")"

echo "🇳🇱 Dutch Tutor Setup"
echo "────────────────────"

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "❌ Python 3 not found. Please install it first."
  exit 1
fi

# Create venv
if [ ! -d ".venv" ]; then
  echo "→ Creating virtual environment..."
  python3 -m venv .venv
fi

echo "→ Activating virtual environment..."
source .venv/bin/activate

echo "→ Installing dependencies..."
pip install -q -r requirements.txt

# API key
if [ ! -f ".env" ]; then
  echo ""
  echo "────────────────────────────────────────────────"
  echo "  ANTHROPIC API KEY REQUIRED"
  echo "  Get one at: https://console.anthropic.com"
  echo "────────────────────────────────────────────────"
  read -p "  Paste your API key: " api_key
  echo "ANTHROPIC_API_KEY=$api_key" > .env
  echo "  ✓ Saved to .env"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To run the app:"
echo "  source .venv/bin/activate && python app.py"
echo ""
echo "The 🇳🇱 icon will appear in your menu bar."
