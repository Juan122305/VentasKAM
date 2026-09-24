# VentasKAM

Tablero **Radar Sell-out Autoservicio** de Fresh Harvest, con dos versiones:

| Versión | Archivo | Quién puede verla |
|---|---|---|
| Web con inicio de sesión de Google | `docs/index.html` (GitHub Pages) | Cualquier cuenta de Google con permiso en la hoja |
| Artifact de claude.ai | `dashboard/index.html` | El dueño y quien tenga acceso en claude.ai |

Este repositorio no guarda datos de ventas: las páginas solo contienen código y leen la hoja de Google al abrirse.

## Configurar la versión web (una sola vez)

### 1. Hoja de Google en acceso restringido
En Google Sheets → **Compartir** → Acceso general: **Restringido**. Agrega ahí los correos de quienes verán el tablero (como Lector).

### 2. Crear el Client ID de Google
1. Entra a <https://console.cloud.google.com/> y crea un proyecto (por ejemplo "Radar Sell-out").
2. **APIs y servicios → Biblioteca**: habilita **Google Sheets API**.
3. **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Si solo entran cuentas `@freshharvest.info`, elige **Interno**.
   - Si entran cuentas de fuera, elige **Externo** y agrega sus correos en **Usuarios de prueba**.
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - Orígenes de JavaScript autorizados: `https://juan122305.github.io`
5. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`) y pégalo en `CLIENT_ID` dentro de `docs/index.html`.

### 3. Publicar con GitHub Pages
En el repositorio → **Settings → Pages** → Source: *Deploy from a branch* → rama con estos archivos, carpeta **`/docs`**.
El tablero queda en `https://juan122305.github.io/VentasKAM/`.

## Cómo se actualiza
- Lee la hoja cada vez que alguien inicia sesión y la vuelve a leer cada 10 minutos mientras está abierta (también con **Actualizar**).
- Pestañas que espera: `fact_serie` (obligatoria), `dim_tiendas` y `Leeme`.
- Para cargar datos nuevos, actualiza esa misma hoja. Si cambias de hoja, cambia `SHEET_ID` en `docs/index.html`.
