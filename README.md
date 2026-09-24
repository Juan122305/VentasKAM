# VentasKAM

Tablero **Radar Sell-out Autoservicio** (`dashboard/index.html`) para Fresh Harvest.

- Lee en vivo, con el conector de Google Drive del usuario, la hoja más reciente cuyo nombre contiene `Sellout_Limpio`.
- Vuelve a revisar la hoja cada 10 minutos mientras está abierto, y también con el botón **Actualizar**.
- Si no hay conexión, se puede cargar el Excel a mano con **Cargar Excel**.
- Hojas que espera: `fact_serie` (obligatoria), `dim_tiendas` y `Leeme`.

Este repositorio no guarda datos de ventas: el tablero solo contiene código.
