"""Genera dashboard/index.html (tablero de claude.ai) a partir de docs/index.html (tablero web).

Los dos tableros comparten la interfaz y los cálculos. Solo cambia de dónde salen los datos:
- docs/: inicio de sesión con Google y lectura de la hoja con la Sheets API.
- dashboard/: conector de Google Drive de claude.ai (o un Excel cargado a mano).

Uso: python3 tools/build_artifact.py
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / "docs" / "index.html").read_text(encoding="utf-8")


def cut(text, start, end, repl=""):
    i = text.index(start)
    j = text.index(end, i) + len(end)
    return text[:i] + repl + text[j:]


def rep(text, old, new):
    assert text.count(old) == 1, old[:60]
    return text.replace(old, new)


s = src
# The artifact viewer supplies the document skeleton: keep only title, fonts, style and body content.
s = re.sub(r"^<!doctype html>\s*<html[^>]*>\s*<head>\s*", "", s)
s = re.sub(r'<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*<meta name="robots"[^>]*>\s*', "", s)
s = rep(s, "</head>\n<body class=\"locked\">\n", "")
s = s.replace("</body>\n</html>\n", "")
# No login screen: the viewer's claude.ai session and Drive connector stand in for it.
s = cut(s, '<div class="gate" id="gate"', "</div>\n</div>\n\n")
s = rep(s, '<button class="btn ghost" id="btnLogout" type="button">Cerrar sesión</button>',
        '<label class="btn ghost" for="fileIn">Cargar Excel</label>\n        <input type="file" id="fileIn" accept=".xlsx,.xls" hidden>')
s = rep(s, '<p id="srcTitle">Hoja de Google · Sell-out</p>\n        <p id="srcMeta" class="muted">Inicia sesión para cargar los datos</p>',
        '<p id="srcTitle">Conectando con Google Drive…</p>\n        <p id="srcMeta" class="muted">Buscando tu archivo Sellout_Limpio</p>')
s = rep(s, "Los datos se leen de la hoja de Google cada vez que inicias sesión, y se revisan de nuevo cada 10 minutos mientras el tablero está abierto.",
        "Los datos se leen de tu hoja en Google Drive cada vez que abres el tablero, y se revisan de nuevo cada 10 minutos mientras está abierto.")
s = rep(s, '<script src="https://accounts.google.com/gsi/client" async defer></script>',
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>')
s = cut(s, "  // Configuración del acceso con Google", 'const SHEET_ID = "1FYVjV3c0HrzrSK-spsIPfzyvh3rlnfDKZ8tutDOvrYo";\n',
        '  const SERVER = "Google Drive";\n'
        "  const SEARCH = { query: \"title contains 'Sellout_Limpio' and mimeType = 'application/vnd.google-apps.spreadsheet'\", pageSize: 10, excludeContentSnippets: true };\n"
        '  const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";\n')
# Replace everything from the status helpers to the end of the script with the Drive data flow.
i = s.index("  // ---------- status ----------")
j = s.index("</script>", i)
s = s[:i] + (ROOT / "tools" / "artifact_flow.js").read_text(encoding="utf-8") + s[j:]

(ROOT / "dashboard" / "index.html").write_text(s, encoding="utf-8")
print("dashboard/index.html generado")
