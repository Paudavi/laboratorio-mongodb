import express from 'express';
import mongoose, { Schema } from 'mongoose';
import { ObjectId } from 'mongodb';

const app = express();
app.use(express.json());
app.use(express.static('public'));

const URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
const PUERTO = 3000;
const BASE = 'analytics_web'

// Período que cubren los datos de prueba.
const DESDE_DEFAULT = '2026-09-01';
const HASTA_DEFAULT = '2026-10-01';

/**
 * MongoDB no exige esquema: la validación la pone la aplicación.
 * Acá se define porque un sitio siempre tiene la misma forma.
 */
const Sitio = mongoose.model('Sitio', new Schema({
    nombre: { type: String, required: true },
    dominio: { type: String, required: true }
}, { collection: 'sitios', versionKey: false }));

const Item = mongoose.model('Item', new Schema({
    sitio_id: { type: Schema.Types.ObjectId, required: true },
    titulo: { type: String, required: true },
    categoria: String,
    precio_actual: Number,
    url_path: String,
}, { collection: 'items', versionKey: false }));

const db = () => mongoose.connection.getClient().db(BASE);

// Helper
async function params(q: any) {
    const sitio = q.sitio
        ? new ObjectId(String(q.sitio))
        : (await db().collection('sitios').findOne({}))!._id;
    return {
        sitio,
        desde: new Date(`${q.desde ?? DESDE_DEFAULT}T00:00:00Z`),
        hasta: new Date(`${q.hasta ?? HASTA_DEFAULT}T00:00:00Z`),
    }
}


app.get('/api/salud', (req, resp) => {
    resp.json({ ok: true });
});

app.get('/api/sitios', async (req, resp) => {
    const sitios = await Sitio.find();
    resp.json(sitios);
});

app.get('/api/sitios/:id', async (req, resp) => {
    const sitio = await Sitio.findById(req.params.id);
    if (!sitio) return resp.status(404).json({ error: 'No existe el sitio id' });
    resp.json(sitio);
});

app.post('/api/sitios', async (req, resp) => {
    const sitio = await Sitio.create(req.body);
    resp.status(201).json(sitio);
});

app.put('/api/sitios/:id', async (req, resp) => {
    const sitio = await Sitio.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true //mongoose valida al crear pero no al actualizar, hay que pedirlo explícitamente
    });
    if (!sitio) return resp.status(404).json({ error: 'No existe el sitio id' });
    resp.json(sitio);
});

app.delete('/api/sitios/:id', async (req, resp) => {
    const sitio = await Sitio.findByIdAndDelete(req.params.id);
    if (!sitio) return resp.status(404).json({ error: 'No existe el sitio id' });
    resp.json({ borrado: true });
});

app.get('/api/items', async (req, resp) => {
    const filtro = req.query.sitio ? { sitio_id: new ObjectId(String(req.query.sitio)) } : {};
    const items = await Item.find(filtro);
    resp.json(items);
});

app.get('/api/items', async (requestAnimationFrame, resp) => {
    const items = await Item.find();
    resp.json(items);
});

app.get('/api/items/:id', async (req, resp) => {
    const item = await Item.findById(req.params.id);
    if (!item) return resp.status(404).json({ error: 'No existe el item id' });
    resp.json(item);
});


app.post('/api/items', async (req, resp) => {
    const item = await Item.create(req.body);
    resp.status(201).json(item);
});

app.put('/api/items/:id', async (req, resp) => {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });
    if (!item) return resp.status(404).json({ error: 'No existe el item id' });
    resp.json(item);
});

app.delete('/api/items/:id', async (req, resp) => {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return resp.status(404).json({ error: 'No existe el item id' })
    resp.json({ borrado: true })
});

app.get('/api/reportes/items-mas-vistos', async (req, res) => {
    const { sitio, desde, hasta } = await params(req.query);

    const resultado = await db().collection('eventos').aggregate([
        { $match: { sitio_id: sitio, tipo: 'pageview', ts: { $gte: desde, $lt: hasta } } },
        { $group: { _id: '$page.item_id', vistas: { $sum: 1 }, visitantes: { $addToSet: '$visitante_id' } } },
        { $match: { _id: { $ne: null } } },
        { $project: { vistas: 1, visitantes_unicos: { $size: '$visitantes' } } },
        { $sort: { vistas: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'items', localField: '_id', foreignField: '_id', as: 'item' } },
        { $unwind: '$item' },
        { $project: { _id: 0, titulo: '$item.titulo', categoria: '$item.categoria', vistas: 1, visitantes_unicos: 1 } },
    ]).toArray();

    res.json(resultado);
});

app.get('/api/reportes/ctr', async (req, res) => {
    const { sitio, desde, hasta } = await params(req.query);

    const resultado = await db().collection('eventos').aggregate([
        { $match: { sitio_id: sitio, tipo: { $in: ['pageview', 'click'] }, ts: { $gte: desde, $lt: hasta } } },
        {
            $group: {
                _id: '$page.path',
                vistas: { $sum: { $cond: [{ $eq: ['$tipo', 'pageview'] }, 1, 0] } },
                clicks: { $sum: { $cond: [{ $eq: ['$tipo', 'click'] }, 1, 0] } },
            }
        },
        { $match: { vistas: { $gte: 100 } } },
        { $project: { vistas: 1, clicks: 1, ctr: { $round: [{ $divide: ['$clicks', '$vistas'] }, 3] } } },
        { $sort: { ctr: -1 } },
    ]).toArray();

    res.json(resultado);
});

app.get('/api/reportes/recorridos', async (req, res) => {
    const { sitio, desde, hasta } = await params(req.query);

    const resultado = await db().collection('eventos').aggregate([
        { $match: { sitio_id: sitio, tipo: 'pageview', ts: { $gte: desde, $lt: hasta } } },
        { $sort: { sesion_id: 1, ts: 1 } },
        { $group: { _id: '$sesion_id', camino: { $push: '$page.path' } } },
        { $project: { camino: { $slice: ['$camino', 4] } } },
        { $match: { $expr: { $eq: [{ $size: '$camino' }, 4] } } },
        { $group: { _id: '$camino', sesiones: { $sum: 1 } } },
        { $sort: { sesiones: -1 } },
        { $limit: 10 },
    ]).toArray();

    res.json(resultado);
});

app.get('/api/reportes/abandono', async (req, res) => {
    const { sitio, desde, hasta } = await params(req.query);

    const resultado = await db().collection('sesiones').aggregate([
        { $match: { sitio_id: sitio, convirtio: false, inicio: { $gte: desde, $lt: hasta } } },
        { $addFields: { total_pasos: { $size: '$pasos' } } },
        { $unwind: '$pasos' },
        { $match: { $expr: { $eq: ['$pasos.orden', '$total_pasos'] } } },
        { $group: { _id: { path: '$pasos.path', profundidad: '$pasos.orden' }, cantidad: { $sum: 1 } } },
        { $sort: { cantidad: -1 } },
        { $limit: 15 },
    ]).toArray();

    res.json(resultado);
});

app.post('/api/eventos', async (req, resp) => {
    const ev = req.body;

    if (!ev?.tipo || !ev?.sesion_id) {
        return resp.status(400).json({ error: 'Falta tipo o sesion_id' });
    }

    const nuevo = {
        ...ev,
        sitio_id: new ObjectId(String(ev.sitio_id)),
        ts: new Date(ev.ts ?? Date.now()),
    };

    if (ev.page?.item_id) {
        nuevo.page = { ...ev.page, item_id: new ObjectId(String(ev.page.item_id)) };
    }

    await db().collection('eventos').insertOne(nuevo);
    
    resp.status(201).json({ ok: true });
});

app.get('/api/contadores', async (_req, resp) => {
    const colecciones = ['sitios', 'items', 'visitantes', 'sesiones', 'eventos', 'metricas_diarias'];
    const totales: Record<string, number> = {};

    for (const c of colecciones) {
        totales[c] = await db().collection(c).countDocuments();
    }
    resp.json(totales);
});

try {
    await mongoose.connect(URI, { dbName: BASE });
    console.log(`Conectado a ${BASE}`);
    app.listen(PUERTO, () => {
        console.log(`Escuchando en http://localhost:${PUERTO}`);
    });
} catch {
    console.error(`No se puedo conectar a MongoDB en ${URI}`);
    console.error('¿Está corriendo? Probá: brew services start mongodb-community');
    process.exit(1);
}

//Manejo de errores

app.use((_req, resp) => {
    resp.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err: any, _req: any, resp: any, _next: any) => {
    const esValidacion = err?.name == 'ValidationError' || err?.name === 'CastError';
    resp.status(esValidacion ? 400 : 500).json({ error: err.message })
});