  // ---------- status ----------
  function setStatus(kind, title, meta) {
    $("srcDot").className = "src-dot " + kind;
    $("srcTitle").textContent = title;
    $("srcMeta").textContent = meta || "";
  }
  function banner(title, body, info) {
    const b = $("banner");
    if (!title) { b.hidden = true; return; }
    b.className = "banner" + (info ? " info" : "");
    b.innerHTML = `<strong>${esc(title)}</strong>${esc(body || "")}`;
    b.hidden = false;
  }

  let loaded = { id: null, modified: null, title: "", manual: false }, lastCheck = null;
  function describeLoaded() {
    const mod = loaded.modified ? fmtDate.format(new Date(loaded.modified)) : "";
    const chk = lastCheck ? ` · Revisado ${fmtDate.format(new Date(lastCheck))}` : "";
    setStatus("ok", loaded.title || "Archivo cargado", (mod ? "Modificado " + mod : "") + chk);
  }

  const DENIALS = ["needs_reauth", "server_not_connected", "selection_required", "blocked_by_policy", "approval_required", "not_in_manifest"];
  function handleErr(e, stage) {
    const code = (e && e.code) || "upstream_error";
    const map = {
      needs_reauth: ["Tu conexión con Google Drive expiró.", " Vuelve a conectarla en claude.ai → Configuración → Conectores y recarga el tablero."],
      server_not_connected: ["Conecta Google Drive para ver tus datos.", " Agrégalo en claude.ai → Configuración → Conectores, o usa Cargar Excel."],
      selection_required: ["Elige qué conexión de Google Drive usar.", " Tienes más de una; selecciónala cuando claude.ai te lo pida, o usa Cargar Excel."],
      not_in_manifest: ["Este tablero necesita permiso para leer Google Drive.", " Permite el acceso cuando claude.ai te lo pida y recarga, o usa Cargar Excel."],
      blocked_by_policy: ["Tu organización restringe el acceso a Google Drive desde aquí.", " Usa Cargar Excel para ver tus datos."],
      approval_required: ["Tu organización pide aprobación para leer Google Drive.", " Usa Cargar Excel para ver tus datos."],
      server_unavailable: ["Google Drive tardó en responder.", " Se muestran los últimos datos cargados; presiona Actualizar en unos minutos."],
      tool_error: ["Google Drive no pudo entregar el archivo.", " " + (e && e.message ? e.message : "")],
      bad_file: ["El archivo no tiene el formato esperado.", " " + (e && e.message ? e.message : "")]
    };
    const [t, b] = map[code] || ["No se pudo leer el archivo en este momento.", " Presiona Actualizar para intentar de nuevo, o usa Cargar Excel."];
    banner(t, b);
    if (DENIALS.includes(code)) {
      if (!loaded.manual) { D = null; loaded = { id: null, modified: null, title: "", manual: false }; renderEmpty("Conecta Google Drive o carga tu Excel para ver el tablero."); }
      setStatus("err", "Sin conexión a Google Drive", "Puedes cargar el Excel manualmente");
    } else if (D) describeLoaded();
    else { setStatus("err", "No se pudo cargar", stage === "search" ? "Buscando el archivo" : "Descargando el archivo"); renderEmpty("Los datos aparecerán aquí en cuanto se lea el archivo."); }
  }

  // ---------- data flow ----------
  function workbookRows(wb) {
    const get = name => {
      const key = wb.SheetNames.find(n => n.trim().toLowerCase() === name.toLowerCase());
      return key ? XLSX.utils.sheet_to_json(wb.Sheets[key], { defval: null, raw: true }) : null;
    };
    const serie = get("fact_serie");
    if (!serie || !serie.length) throw { code: "bad_file", message: "El archivo no tiene la hoja fact_serie." };
    return { fact_serie: serie, dim_tiendas: get("dim_tiendas") || [], leeme: get("Leeme") || [], fact_tienda_sku: get("fact_tienda_sku") || [], dim_productos: get("dim_productos") || [] };
  }
  function ingest(wb, src) {
    D = parseSheets(workbookRows(wb));
    loaded = src;
    banner(null);
    renderAll();
    describeLoaded();
  }

  let mcp = null, busy = false, pending = null, retried = false, unwatch = null, forceNext = false;

  async function download(f) {
    if (busy) { pending = f; return; }
    busy = true;
    setStatus("busy", "Descargando " + (f.title || "archivo") + "…", "Leyendo la versión más reciente");
    try {
      const r = await mcp.callTool(SERVER, "download_file_content", { fileId: f.id, exportMimeType: XLSX_MIME }, { cache: false });
      const p = r && r.payload;
      const b64 = p && typeof p === "object" ? p.content : null;
      if (!b64) throw { code: "bad_file", message: "Google Drive no devolvió el contenido del archivo." };
      ingest(XLSX.read(b64, { type: "base64", cellDates: true }), { id: f.id, modified: f.modifiedTime || null, title: p.title || f.title || "Sellout", manual: false });
      retried = false;
    } catch (e) {
      if (e && e.retryable && !retried) {
        retried = true; busy = false;
        setTimeout(() => download(f), (e.retryAfterMs || 1500) + Math.random() * 1000);
        return;
      }
      handleErr(e, "download");
    } finally {
      busy = false;
      if (pending) { const n = pending; pending = null; download(n); }
    }
  }

  function onSearch(ev) {
    if (ev.type === "error") { handleErr(ev.error, "search"); return; }
    const res = ev.result || {};
    lastCheck = (res.cache && res.cache.storedAt) || Date.now();
    const files = res.payload && Array.isArray(res.payload.files) ? res.payload.files : [];
    const f = files.slice().sort((a, b) => String(b.modifiedTime || "").localeCompare(String(a.modifiedTime || "")))[0];
    if (!f) {
      banner("No encontramos tu hoja de sell-out en Google Drive.", " El tablero busca una hoja de cálculo cuyo nombre contenga Sellout_Limpio. Revisa el nombre o usa Cargar Excel.");
      if (D) describeLoaded(); else { setStatus("err", "Archivo no encontrado", "Buscando Sellout_Limpio en tu Drive"); renderEmpty("Los datos aparecerán aquí en cuanto se encuentre el archivo."); }
      return;
    }
    const force = forceNext; forceNext = false;
    if (loaded.manual && !force && !(Date.parse(f.modifiedTime || "") > loaded.modified)) { describeLoaded(); return; }
    if (force || f.id !== loaded.id || (f.modifiedTime || null) !== loaded.modified) download(f);
    else describeLoaded();
  }

  function startWatch() {
    if (unwatch) unwatch();
    unwatch = mcp.watchTool(SERVER, "search_files", SEARCH, onSearch, { refetchInterval: POLL_MS });
  }

  $("btnRefresh").addEventListener("click", async () => {
    if (!mcp) { banner("La lectura automática no está disponible en esta vista.", " Usa Cargar Excel para ver tus datos más recientes.", true); return; }
    setStatus("busy", "Buscando cambios…", "Revisando tu archivo en Google Drive");
    forceNext = true;
    try { await mcp.invalidate(SERVER, "search_files"); } catch {}
    startWatch();
  });

  $("fileIn").addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        ingest(XLSX.read(new Uint8Array(rd.result), { type: "array", cellDates: true }), { id: null, modified: file.lastModified, title: file.name, manual: true });
        banner("Estás viendo el archivo que cargaste.", " Presiona Actualizar para volver a leer tu hoja de Google Drive.", true);
      } catch (err) { handleErr(err && err.code ? err : { code: "bad_file", message: "No se pudo leer el archivo. Verifica que sea el Excel de sell-out." }, "manual"); }
      e.target.value = "";
    };
    rd.readAsArrayBuffer(file);
  });

  async function boot() {
    renderEmpty("Cargando tus datos de sell-out…");
    if (typeof XLSX === "undefined") { setStatus("err", "No se pudo cargar el lector de Excel", "Recarga la página"); return; }
    mcp = window.claude && window.claude.use ? await window.claude.use("mcp") : null;
    if (!mcp) {
      setStatus("err", "Lectura automática no disponible aquí", "Carga tu Excel para ver el tablero");
      banner("Abre este tablero en claude.ai para que lea tu hoja de Google Drive.", " Mientras tanto, puedes cargar el Excel de sell-out con el botón Cargar Excel.", true);
      renderEmpty("Carga tu Excel de sell-out para ver el tablero.");
      return;
    }
    startWatch();
  }
  boot();
})();
