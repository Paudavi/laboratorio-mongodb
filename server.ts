import express from 'express';
import mongoose, { mongo, Schema } from 'mongoose';
import { ObjectId } from 'mongoose';

const app = express();
app.use(express.json());

const URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
const PUERTO = 3000;
const BASE = 'analytics_web'

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
    precio: Number,
}, { collection: 'items', versionKey: false }));

app.get('/api/salud', (req, resp) => {
    resp.json({ ok: true });
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
    const filtro = req.query.sitio ? { sitio_id: new mongoose.Types.ObjectId(String(req.query.sitio)) } : {};
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