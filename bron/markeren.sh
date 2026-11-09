#!/usr/bin/env bash
# Automatisch markeren (op papier): bouwt de pagina met de data uit deze map, zet de slotkoers bij afgelopen
# markeringen en voegt nieuwe waardeweddenschappen toe aan data/picks.json. Draait in de Action 'Odds ophalen'.
set -euo pipefail
cd "$(dirname "$0")/.."
T="$(mktemp -d)"
python3 bron/bouw.py "$T/basis.html"
VOETBAL_DATA_DIR=data python3 bron/update_data.py "$T/basis.html" "$T/pagina.html" --af data/apifootball.json --picks-uit data/picks.json | tail -n 8
node bron/waarde.js "$T/pagina.html" data/picks.json
python3 -c "import json; json.load(open('data/picks.json'))"
rm -rf "$T"
