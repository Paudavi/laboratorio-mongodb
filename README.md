# Plataforma de analítica web con MongoDB
 
Laboratorio del Taller de Bases de Datos NoSQL 2026
Tecnólogo en Informática · UdelaR
Paula Dávila
 
Versión reducida de una plataforma de analítica de comportamiento web, en la línea de Google Analytics, Klaviyo o Hotjar. Recibe la actividad de los visitantes de una tienda online, la guarda en MongoDB y responde preguntas como cuál es el producto más visto, qué páginas se clickean, cuál es el recorrido más común y dónde abandonan los visitantes.
 
---
 
## Qué hay en el repositorio
 
```
├── server.ts          API REST: CRUD, creador de eventos y reportes
├── public/
│   └── tienda.html    Tienda simulada que genera eventos reales
├── bruno/             Colección de Bruno con todas las pruebas
├── datos/             Datos de prueba para importar
├── package.json
└── tsconfig.json
```
 
---
 
## Puesta en marcha
 
Requiere **Node.js 20 o superior** y **MongoDB** corriendo en `localhost:27017`.
 
### 1. Cargar los datos de prueba
 
Desde la carpeta del proyecto:
 
```bash
cd datos
for c in sitios items visitantes sesiones eventos metricas_diarias; do
  mongoimport --db analytics_web --collection $c --file $c.json --drop
done
cd ..
```
 
`mongoimport` viene con las MongoDB Database Tools. `--drop` borra la colección antes de importar, así que se puede correr varias veces.
 
Para comprobar que funcionó, en mongosh ejecutar:
 
```js
use analytics_web
["sitios","items","visitantes","sesiones","eventos","metricas_diarias"].forEach(c => print(c.padEnd(20) + db.getCollection(c).countDocuments()))
```
 
```
sitios              1
items               36
visitantes          4874
sesiones            9000
eventos             51859
metricas_diarias    1377
```
 
### 2. Levantar la API
 
```bash
npm install
npm start
```
 
```
Conectado a analytics_web
Escuchando en http://localhost:3000
```
 
Para usar otra base, definí la variable de entorno `MONGODB_URI`:
 
```bash
MONGODB_URI=mongodb://otro-servidor:27017 npm start
```
 
### 3. Abrir la tienda
 
**http://localhost:3000/tienda.html**
 
---
 
## Las colecciones
 
| Colección | Qué guarda |
|---|---|
| `sitios` | Cada sitio que mide la plataforma |
| `items` | Catálogo de productos de cada sitio |
| `visitantes` | Identidad anónima de cada persona que navega |
| `sesiones` | Una visita completa, con la secuencia de páginas embebida |
| `eventos` | Cada acción individual: vistas, clicks, carrito, compra |
| `metricas_diarias` | Resultados precalculados por día y página |
 
`sitios` e `items` tienen esquema fijo, validado con Mongoose: siempre tienen la misma forma. `eventos` no tiene esquema a propósito: cada tipo de evento trae campos distintos en `props`, y esa flexibilidad es una de las razones por las que se eligió MongoDB.
 
---
 
## Endpoints
 
### Salud
 
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/salud` | Responde `{ ok: true }` si el servidor está andando |
 
### Sitios e items
 
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/sitios` | Lista todos los sitios |
| GET | `/api/sitios/:id` | Trae un sitio |
| POST | `/api/sitios` | Crea un sitio |
| PUT | `/api/sitios/:id` | Modifica un sitio |
| DELETE | `/api/sitios/:id` | Borra un sitio |
| GET | `/api/items?sitio=<id>` | Lista los items, opcionalmente de un sitio |
| GET | `/api/items/:id` | Trae un item |
| POST | `/api/items` | Crea un item |
| PUT | `/api/items/:id` | Modifica un item |
| DELETE | `/api/items/:id` | Borra un item |
 
### Registro de eventos
 
| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/eventos` | Registra un evento. Exige `tipo` y `sesion_id` |
| GET | `/api/contadores` | Cantidad de documentos de cada colección |
 
Ejemplo de evento:
 
```json
{
  "sitio_id": "66f1a2b3c4d5e6f700000001",
  "sesion_id": "s_web_1",
  "visitante_id": "v_web_1",
  "tipo": "pageview",
  "page": { "path": "/productos/zapatilla-running-verde", "item_id": "66f1a2b3c4d5e6f700000005" },
  "props": {}
}
```
 
Al recibirlo, la API convierte `sitio_id` y `page.item_id` a `ObjectId` y `ts` a `Date`. En JSON todo llega como texto, y sin esa conversión las consultas no encontrarían los eventos nuevos.
 
### Reportes
 
| Método | Ruta | Pregunta que responde |
|---|---|---|
| GET | `/api/reportes/items-mas-vistos` | ¿Cuáles son los diez productos más vistos? |
| GET | `/api/reportes/ctr` | ¿Qué páginas se clickean y cuáles no? |
| GET | `/api/reportes/recorridos` | ¿Cuáles son los recorridos más frecuentes? |
| GET | `/api/reportes/abandono` | ¿En qué página abandonan los que no compran? |
 
Todos aceptan los parámetros `sitio`, `desde` y `hasta`:
 
```
/api/reportes/items-mas-vistos?desde=2026-11-01&hasta=2026-12-01
```
 
Si no se indican, usan el primer sitio y septiembre de 2026, que es el período que cubren los datos de prueba. **Para ver los eventos generados con la tienda hay que pedir fechas que incluyan el día de hoy.**
 
Los cuatro reportes se resuelven enteros con el Aggregation Pipeline de MongoDB: la API solo recibe el resultado.
 
### Errores
 
| Código | Cuándo |
|---|---|
| 400 | Faltan campos obligatorios o un id no tiene formato válido |
| 404 | La ruta no existe, o el recurso pedido no existe |
| 500 | Error interno del servidor |
 
---
 
## La tienda
 
`tienda.html` simula una tienda online con los productos reales de la base. Cada acción manda un evento a `POST /api/eventos`, con la misma forma que los datos de prueba:
 
| Acción | Evento |
|---|---|
| Cambiar de pantalla | `pageview` |
| Apretar un botón o una tarjeta | `click` |
| Agregar al carrito | `add_to_cart` |
| Ir a pagar | `checkout_start` |
| Confirmar la compra | `purchase` |
 
El panel de la derecha muestra los documentos de cada colección, el último evento enviado y el historial.
 
El navegador guarda un `visitante_id` en `localStorage` que se mantiene entre visitas, y cada carga de la página es una sesión nueva. Así los reportes distinguen vistas de visitantes únicos.
 
La tienda solo escribe en `eventos`. El reporte de abandono lee `sesiones`, así que no refleja lo que se hace en la tienda.
 
## Probar con Bruno
 
La carpeta `bruno/` es una colección de [Bruno](https://www.usebruno.com/) con una request por endpoint, organizada en:
 
- **Consultas**: los cuatro reportes, los contadores y la creación de eventos
- **Errores**: casos que tienen que responder 400 o 404
- El CRUD de sitios e items
Para usarla: en Bruno, **Open Collection** → carpeta `bruno`, y elegí el entorno **URL**, que apunta a `http://localhost:3000`.
 
---
 
## Tecnologías
 
- **Node.js + TypeScript**
- **Express** para la API
- **Mongoose** para el CRUD, con validación de esquema
- **Driver oficial de MongoDB** para los reportes y la ingesta, compartiendo la conexión de Mongoose
 