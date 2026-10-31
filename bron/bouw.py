#!/usr/bin/env python3
"""Bouwt de Voetbalvoorspeller-pagina uit de bronbestanden (zonder data) en zet het updatescript en waarde.js erin.
Gebruik: python3 bron/bouw.py basis.html  →  daarna: python3 bron/update_data.py basis.html pagina.html
                                              en: node bron/waarde.js pagina.html data/picks.json pagina2.html"""
import os, sys
d = os.path.dirname(os.path.abspath(__file__))
delen = ["p1_head.html", "p2_data.js", "p2b_extra.js", "p3_engine.js", "p3b_value.js", "p4_ui.js"]
b = "".join(open(os.path.join(d, f), encoding="utf-8").read() for f in delen) + "\nboot();\n</script>\n"
up = open(os.path.join(d, "update_data.py"), encoding="utf-8").read(); wa = open(os.path.join(d, "waarde.js"), encoding="utf-8").read()
assert "</script" not in up and "</script" not in wa
b += '\n<script type="text/x-python" id="updater">\n' + up + '</script>\n<script type="text/x-node" id="waarde">\n' + wa + '</script>\n'
open(sys.argv[1], "w", encoding="utf-8").write(b); print("Geschreven:", sys.argv[1])
