import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';

// --- CONFIGURACIÓN INICIAL ---
const app = express();
const prisma = new PrismaClient(); // Instancia única de Prisma
const PORT = process.env.PORT || 3001;
const SECRET_KEY = 'secret_key';

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static('uploads'));

// Configuración de subida de archivos
const uploadDir = 'uploads/evidencias';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Middleware de verificación de Token
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(403).json({ error: "No se proporcionó token de seguridad" });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Token inválido o expirado" });
        req.userId = decoded.id;
        req.userRol = decoded.rol;
        next();
    });
};

// ==========================================
//           RUTAS DE AUTENTICACIÓN
// ==========================================

// 1. LOGIN
app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const usuario = await prisma.usuarios.findFirst({
            where: { username, password_hash: password },
            include: { tutor: true, roles: true }
        });

        if (usuario) {
            const token = jwt.sign(
                { id: usuario.id, rol: usuario.roles?.nombre_rol },
                SECRET_KEY,
                { expiresIn: '8h' }
            );
            res.json({
                id: usuario.id,
                username: usuario.username,
                roles: usuario.roles,
                tutor_id: usuario.tutor?.id || null,
                nombre: usuario.tutor?.nombres_apellidos || usuario.username,
                token: token
            });
        } else {
            res.status(401).json({ error: "Credenciales incorrectas" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// 20. CAMBIAR CONTRASEÑA
app.post('/cambiar-clave', async (req, res) => {
    try {
        await prisma.usuarios.update({
            where: { id: parseInt(req.body.usuario_id) },
            data: { password_hash: req.body.nueva_clave }
        });
        res.json({ message: "Contraseña actualizada" });
    } catch (error) { res.status(500).json({ error: "Error al cambiar clave" }); }
});

// ==========================================
//           RUTAS DE GESTIÓN ACADÉMICA
// ==========================================

// 2. OBTENER LISTA DE ESTUDIANTES (DASHBOARD)
app.get('/estudiantes', verifyToken, async (req, res) => {
    try {
        const tutor = await prisma.tutores.findUnique({ where: { usuario_id: req.userId } });
        if (!tutor) return res.status(404).json({ error: "Tutor no encontrado o no asignado." });

        const estudiantesRaw = await prisma.estudiantes.findMany({
            where: { tutor_asignado_id: tutor.id },
            include: {
                sesiones_tutoria: true, 
                derivaciones: true,
                asistencia_grupal: { include: { sesion_grupal: true } }
            },
            orderBy: { nombres_apellidos: 'asc' }
        });

        const estudiantesProcesados = estudiantesRaw.map(est => {
            const sesionesUnificadas = [
                ...est.sesiones_tutoria.map(s => ({ ...s, tipo_formato: s.tipo_formato || 'F04' })),
                ...est.derivaciones.map(d => ({ ...d, tipo_formato: 'F05', fecha: d.fecha_solicitud })),
                ...est.asistencia_grupal.map(a => ({ ...a.sesion_grupal, tipo_formato: 'F02' }))
            ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            return { ...est, sesiones: sesionesUnificadas };
        });

        res.json(estudiantesProcesados);
    } catch (error) {
        console.error("Error en GET /estudiantes:", error);
        res.status(500).json({ error: error.message });
    }
});

// 3. OBTENER HISTORIAL COMPLETO DE UN ESTUDIANTE
app.get('/sesiones/:estudianteId', async (req, res) => {
    const { estudianteId } = req.params;
    try {
        const id = parseInt(estudianteId);
        const [sesiones, derivaciones, grupales] = await Promise.all([
            prisma.sesiones_tutoria.findMany({ where: { estudiante_id: id }, orderBy: { fecha: 'desc' } }),
            prisma.derivaciones.findMany({ where: { estudiante_id: id }, orderBy: { fecha_solicitud: 'desc' } }),
            prisma.asistencia_grupal.findMany({ where: { estudiante_id: id }, include: { sesion_grupal: { include: { asistentes: { include: { estudiantes: true } } } } } })
        ]);

        const historialCompleto = [
            ...sesiones.map(s => ({ ...s, tipo_formato: s.tipo_formato || 'F04' })),
            ...derivaciones.map(d => ({ ...d, tipo_formato: 'F05', fecha: d.fecha_solicitud, firma_tutor_url: d.firma_tutor_url || d.firma_tutor })),
            ...grupales.map(g => ({ ...g.sesion_grupal, tipo_formato: 'F02', id_asistencia: g.id, fecha: g.sesion_grupal.fecha, estudiantes_asistentes: g.sesion_grupal?.asistentes?.map(a => a.estudiantes) || [] }))
        ].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

        res.json(historialCompleto);
    } catch (error) {
        console.error("❌ Error en GET /sesiones:", error.message);
        res.status(500).json({ error: "Error al cargar el historial" });
    }
});

// ==========================================
//           RUTAS DE FORMATOS (F01 - F05)
// ==========================================

// 4. CREAR TUTORÍA GRUPAL (F02)
app.post('/sesiones-grupales', upload.single('evidencia'), async (req, res) => {
    const { tema, fecha, hora_inicio, hora_cierre, area_tema, asistentes_ids, tutor_id, total_asignados, total_asistentes, firma_tutor_url } = req.body;
    let ids = [];
    try { ids = JSON.parse(asistentes_ids || "[]"); } catch (e) { return res.status(400).json({ error: "IDs inválidos" }); }

    try {
        const resultado = await prisma.$transaction(async (tx) => {
            const sesion = await tx.sesiones_grupales.create({
                data: {
                    tema, fecha: new Date(fecha), hora_inicio, hora_cierre, area_tema,
                    tutor_id: parseInt(tutor_id), total_asignados: parseInt(total_asignados || 0), total_asistentes: parseInt(total_asistentes || 0),
                    firma_tutor_url, evidencia_url: req.file ? `/uploads/evidencias/${req.file.filename}` : null
                }
            });
            if (ids.length > 0) {
                await tx.asistencia_grupal.createMany({
                    data: ids.map(eid => ({ estudiante_id: parseInt(eid), sesion_grupal_id: sesion.id, tipo_formato: 'F02' }))
                });
            }
            return sesion;
        });
        res.json(resultado);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 5. EDITAR TUTORÍA GRUPAL (F02)
app.put('/sesiones-grupales/:id', upload.single('evidencia'), async (req, res) => {
    const { id } = req.params;
    const { tema, fecha, hora_inicio, hora_cierre, area_tema, total_asignados, total_asistentes, asistentes_ids, firma_tutor_url } = req.body;
    try {
        let idsArray = JSON.parse(asistentes_ids || "[]");
        await prisma.$transaction(async (tx) => {
            await tx.sesiones_grupales.update({
                where: { id: parseInt(id) },
                data: {
                    tema, fecha: new Date(fecha), hora_inicio, hora_cierre, area_tema,
                    total_asignados: parseInt(total_asignados || 0), total_asistentes: parseInt(total_asistentes || 0),
                    firma_tutor_url, ...(req.file && { evidencia_url: `/uploads/evidencias/${req.file.filename}` })
                }
            });
            await tx.asistencia_grupal.deleteMany({ where: { sesion_grupal_id: parseInt(id) } });
            if (idsArray.length > 0) {
                await tx.asistencia_grupal.createMany({
                    data: idsArray.map(eid => ({ sesion_grupal_id: parseInt(id), estudiante_id: parseInt(eid), tipo_formato: 'F02' }))
                });
            }
        });
        res.json({ message: "Actualizado" });
    } catch (error) { res.status(500).json({ error: "Error actualización" }); }
});

// 6. GUARDAR/ACTUALIZAR FICHA INTEGRAL (F01)
app.post('/sesiones-tutoria/f01', verifyToken, async (req, res) => {
    const d = req.body;
    const estudianteId = parseInt(d.estudiante_id);
    const tutorId = parseInt(d.tutor_id);

    try {
        const resultado = await prisma.$transaction(async (tx) => {
            let datosJSON = { ...d };
            if (typeof d.desarrollo_entrevista === 'string') {
                try { datosJSON = { ...JSON.parse(d.desarrollo_entrevista), ...datosJSON }; } catch (e) {}
            }

            await tx.estudiantes.update({
                where: { id: estudianteId },
                data: {
                    telefono: d.telefono || d.celular || undefined,
                    direccion_actual: d.direccion_actual || d.direccion || undefined,
                    correo_institucional: d.correo_institucional || d.email || undefined,
                    ciclo_actual: d.ciclo_actual || undefined 
                }
            });

            const existente = await tx.sesiones_tutoria.findFirst({ where: { estudiante_id: estudianteId, tipo_formato: 'F01' } });
            const dataSesion = {
                tutor_id: tutorId, estudiante_id: estudianteId, tipo_formato: 'F01', motivo_consulta: 'Ficha Integral',
                fecha: new Date(), firma_tutor_url: d.firma_tutor_url || null, firma_estudiante_url: d.firma_estudiante_url || null,
                desarrollo_entrevista: JSON.stringify(datosJSON)
            };

            return existente 
                ? await tx.sesiones_tutoria.update({ where: { id: existente.id }, data: dataSesion })
                : await tx.sesiones_tutoria.create({ data: dataSesion });
        });
        res.json({ success: true, data: resultado });
    } catch (error) {
        console.error("❌ Error F01:", error);
        res.status(500).json({ error: error.message });
    }
});

// 7. GUARDAR/ACTUALIZAR FICHA DE ENTREVISTA (F03)
app.post('/sesiones-tutoria/f03', async (req, res) => {
    const { id, ...data } = req.body;
    try {
        const payload = {
            ...data, fecha: new Date(), tipo_formato: 'F03',
            estudiante_id: parseInt(data.estudiante_id), tutor_id: parseInt(data.tutor_id)
        };
        const resultado = id 
            ? await prisma.sesiones_tutoria.update({ where: { id: parseInt(id) }, data: payload })
            : await prisma.sesiones_tutoria.create({ data: payload });
        res.json({ message: "Guardado", data: resultado });
    } catch (error) { res.status(500).json({ error: "Error F03" }); }
});

// 8. GUARDAR/ACTUALIZAR FICHA DE SEGUIMIENTO (F04)
// 8. GUARDAR/ACTUALIZAR FICHA DE SEGUIMIENTO (F04)
app.post('/sesiones-tutoria/f04', async (req, res) => {
    const { id, fecha, desarrollo_entrevista, ...data } = req.body;
    try {
        // Aseguramos que desarrollo_entrevista sea un string válido
        let entrevistaJSON = "{}";
        if (desarrollo_entrevista) {
            entrevistaJSON = typeof desarrollo_entrevista === 'object' 
                ? JSON.stringify(desarrollo_entrevista) 
                : desarrollo_entrevista;
        }

        const payload = {
            ...data, 
            fecha: fecha ? new Date(fecha) : new Date(), 
            tipo_formato: 'F04',
            estudiante_id: parseInt(data.estudiante_id), 
            tutor_id: parseInt(data.tutor_id),
            desarrollo_entrevista: entrevistaJSON // Aquí guardamos el JSON stringificado
        };

        const resultado = id 
            ? await prisma.sesiones_tutoria.update({ where: { id: parseInt(id) }, data: payload })
            : await prisma.sesiones_tutoria.create({ data: payload });
            
        res.json({ message: "Guardado", data: resultado });
    } catch (error) { 
        console.error("❌ Error F04 Backend:", error); // Esto mostrará el error real en la terminal
        res.status(500).json({ error: "Error interno F04", detalle: error.message }); 
    }
});

// 9. CREAR DERIVACIÓN (F05)
app.post('/derivaciones', async (req, res) => {
    try {
        const d = req.body;
        const fechaFinal = d.fecha_manual || d.fecha_solicitud || new Date();
        const nueva = await prisma.derivaciones.create({
            data: {
                estudiante_id: parseInt(d.estudiante_id), tutor_id: parseInt(d.tutor_id), tipo_formato: 'F05',
                fecha_solicitud: new Date(fechaFinal),
                motivo_derivacion: d.motivo_derivacion || "Sin motivo", area_destino: d.area_destino || "General",
                nombre_tutor_deriva: d.nombre_tutor_deriva, firma_tutor_url: d.firma_tutor_url,
                escuela_profesional: d.escuela_profesional, semestre: d.semestre, celular: d.celular,
                edad: d.edad ? parseInt(d.edad) : 0, fecha_nacimiento: d.fecha_nacimiento ? new Date(d.fecha_nacimiento) : undefined
            }
        });
        res.json({ message: "Derivación creada", data: nueva });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 10. ACTUALIZAR DERIVACIÓN (F05)
app.put('/derivaciones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const d = req.body;
        const fechaFinal = d.fecha_manual || d.fecha_solicitud;
        const act = await prisma.derivaciones.update({
            where: { id: parseInt(id) },
            data: {
                fecha_solicitud: new Date(fechaFinal), motivo_derivacion: d.motivo_derivacion, area_destino: d.area_destino,
                firma_tutor_url: d.firma_tutor_url, celular: d.celular
            }
        });
        res.json({ message: "Actualizado", data: act });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 11. ELIMINAR SESIONES/REGISTROS
app.delete('/sesiones/:id', async (req, res) => {
    try { await prisma.sesiones_tutoria.delete({ where: { id: parseInt(req.params.id) } }); res.json({ msg: "OK" }); } 
    catch (e) { res.status(500).json({ error: "Error al eliminar" }); }
});
app.delete('/sesiones-grupales/:id', async (req, res) => {
    try { await prisma.sesiones_grupales.delete({ where: { id: parseInt(req.params.id) } }); res.json({ msg: "OK" }); } 
    catch (e) { res.status(500).json({ error: "Error al eliminar" }); }
});
app.delete('/derivaciones/:id', async (req, res) => {
    try { await prisma.derivaciones.delete({ where: { id: parseInt(req.params.id) } }); res.json({ msg: "OK" }); } 
    catch (e) { res.status(500).json({ error: "Error al eliminar" }); }
});

// ==========================================
//           RUTAS DE ADMINISTRACIÓN
// ==========================================

// 14. GESTIÓN DE CICLOS
app.get('/admin/ciclos', async (req, res) => res.json(await prisma.ciclos.findMany({ orderBy: { id: 'desc' } })));
app.post('/admin/ciclos', async (req, res) => {
    try { res.status(201).json(await prisma.ciclos.create({ data: { nombre_ciclo: req.body.nombre_ciclo, activo: true } })); } 
    catch (e) { res.status(500).json({ error: "Error crear ciclo" }); }
});
app.patch('/admin/ciclos/:id/activar', async (req, res) => {
    await prisma.$transaction([
        prisma.ciclos.updateMany({ data: { activo: false } }),
        prisma.ciclos.update({ where: { id: parseInt(req.params.id) }, data: { activo: true } })
    ]);
    res.json({ msg: "Activado" });
});
app.put('/admin/ciclos/:id', async (req, res) => {
    res.json(await prisma.ciclos.update({ where: { id: parseInt(req.params.id) }, data: { nombre_ciclo: req.body.nombre_ciclo } }));
});
app.delete('/admin/ciclos/:id', async (req, res) => {
    const count = await prisma.asignaciones.count({ where: { ciclo_id: parseInt(req.params.id) } });
    if(count > 0) return res.status(400).json({ error: "Tiene alumnos" });
    await prisma.ciclos.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ msg: "Eliminado" });
});

// 15. GESTIÓN DE TUTORES
app.get('/tutores', async (req, res) => res.json(await prisma.tutores.findMany({ where: { activo: true }, orderBy: { nombres_apellidos: 'asc' } })));
app.post('/admin/tutores-completo', async (req, res) => {
    const { nombres, dni, codigo, correo, especialidad, telefono, rol_id } = req.body;
    try {
        const resultado = await prisma.$transaction(async (tx) => {
            const user = await tx.usuarios.create({
                data: { username: dni, password_hash: dni, rol_id: parseInt(rol_id), telefono, activo: true }
            });
            const tutor = await tx.tutores.create({
                data: { nombres_apellidos: nombres, dni, codigo_docente: codigo, correo_institucional: correo, especialidad, usuario_id: user.id, activo: true }
            });
            return { user, tutor };
        });
        res.status(201).json(resultado);
    } catch (e) { res.status(500).json({ error: "Error duplicado" }); }
});
app.delete('/admin/tutores/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const count = await prisma.estudiantes.count({ where: { tutor_asignado_id: id } });
    if (count > 0) return res.status(400).json({ error: "Tiene estudiantes" });
    const tut = await prisma.tutores.findUnique({ where: { id } });
    await prisma.tutores.delete({ where: { id } });
    if(tut?.usuario_id) await prisma.usuarios.delete({ where: { id: tut.usuario_id } });
    res.json({ msg: "Eliminado" });
});

// 16. ROLES
app.get('/roles', async (req, res) => res.json(await prisma.roles.findMany()));

// 17. CARGA MASIVA
app.post('/admin/carga-masiva-estudiantes', async (req, res) => {
    const { estudiantes, tutor_id, ciclo_id } = req.body;
    try {
        const resultado = await prisma.$transaction(async (tx) => {
            const procesados = [];
            for (const est of estudiantes) {
                const alumno = await tx.estudiantes.upsert({
                    where: { dni: est.dni.toString() },
                    update: { nombres_apellidos: est.nombres_apellidos, codigo_estudiante: est.codigo.toString(), tutor_asignado_id: parseInt(tutor_id) },
                    create: { nombres_apellidos: est.nombres_apellidos, dni: est.dni.toString(), codigo_estudiante: est.codigo.toString(), tutor_asignado_id: parseInt(tutor_id) }
                });
                const existe = await tx.asignaciones.findFirst({ where: { estudiante_id: alumno.id, ciclo_id: parseInt(ciclo_id) } });
                if(existe) await tx.asignaciones.update({ where: { id: existe.id }, data: { tutor_id: parseInt(tutor_id) } });
                else await tx.asignaciones.create({ data: { estudiante_id: alumno.id, tutor_id: parseInt(tutor_id), ciclo_id: parseInt(ciclo_id) } });
                procesados.push(alumno);
            }
            return procesados;
        });
        res.json({ mensaje: `Procesados ${resultado.length}`, data: resultado });
    } catch (e) { res.status(500).json({ error: "Error masivo" }); }
});

// 18. GESTIÓN ESTUDIANTES
app.get('/admin/estudiantes/buscar', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    const est = await prisma.estudiantes.findMany({ where: { OR: [{ nombres_apellidos: { contains: q } }, { dni: { contains: q } }, { codigo_estudiante: { contains: q } }] }, take: 10 });
    res.json(est);
});
app.put('/admin/estudiantes/:id', async (req, res) => {
    const { id } = req.params; const { nombres, dni, codigo, tutor_id, ciclo_id, telefono } = req.body;
    await prisma.$transaction(async (tx) => {
        await tx.estudiantes.update({ where: { id: parseInt(id) }, data: { nombres_apellidos: nombres, dni, codigo_estudiante: codigo, telefono, tutor_asignado_id: parseInt(tutor_id) } });
        const asig = await tx.asignaciones.findFirst({ where: { estudiante_id: parseInt(id), ciclo_id: parseInt(ciclo_id) } });
        if(asig) await tx.asignaciones.update({ where: { id: asig.id }, data: { tutor_id: parseInt(tutor_id) } });
        else await tx.asignaciones.create({ data: { estudiante_id: parseInt(id), tutor_id: parseInt(tutor_id), ciclo_id: parseInt(ciclo_id) } });
    });
    res.json({ msg: "OK" });
});

// 19. NOTIFICACIONES
app.get('/admin/notificaciones-asignacion', async (req, res) => {
    const est = await prisma.estudiantes.findMany({ include: { tutor_asignado: true } });
    res.json(est.map(e => ({ id: e.id, estudiante: e.nombres_apellidos, telefono: e.telefono, tutor: e.tutor_asignado?.nombres_apellidos })));
});
app.patch('/admin/estudiantes/:id/telefono', async (req, res) => {
    await prisma.estudiantes.update({ where: { id: parseInt(req.params.id) }, data: { telefono: req.body.telefono } });
    res.json({ msg: "OK" });
});

// ==========================================
//           RUTAS DE REPORTES E INFORMES
// ==========================================

// 22. REMITIR INFORME
app.post('/tutores/remitir-ciclo', upload.single('informe_adjunto'), async (req, res) => {
    try {
        const { tutor_id, semestre, total_estudiantes, total_atendidos, total_riesgo, avance, observaciones } = req.body;
        const informe = await prisma.informes_semestrales.create({
            data: {
                tutor_id: parseInt(tutor_id), semestre: semestre || '2025-I',
                total_estudiantes: parseInt(total_estudiantes || 0), total_atendidos: parseInt(total_atendidos || 0),
                total_riesgo: parseInt(total_riesgo || 0), avance_porcentaje: parseInt(avance || 0),
                observaciones, estado: 'ENVIADO', fecha_envio: new Date(),
                archivo_url: req.file ? `/uploads/evidencias/${req.file.filename}` : null
            }
        });
        res.json({ message: "Enviado", data: informe });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 24. RESUMEN LEGAJO Y CONSOLIDADO
app.get('/admin/resumen-legajo/:tutor_id', async (req, res) => {
    const id = parseInt(req.params.tutor_id);
    const ind = await prisma.sesiones_tutoria.groupBy({ by: ['tipo_formato'], where: { tutor_id: id }, _count: { id: true } });
    const f02 = await prisma.sesiones_grupales.count({ where: { tutor_id: id } });
    const f05 = await prisma.derivaciones.count({ where: { tutor_id: id } });
    res.json([
        { tipo: 'F01', cantidad: ind.find(s => s.tipo_formato === 'F01')?._count.id || 0 },
        { tipo: 'F02', cantidad: f02 },
        { tipo: 'F03', cantidad: ind.find(s => s.tipo_formato === 'F03')?._count.id || 0 },
        { tipo: 'F04', cantidad: ind.find(s => s.tipo_formato === 'F04')?._count.id || 0 },
        { tipo: 'F05', cantidad: f05 }
    ]);
});

app.get('/admin/reporte-consolidado/:tutor_id', async (req, res) => {
    const id = parseInt(req.params.tutor_id);
    const tutor = await prisma.tutores.findUnique({ where: { id }, include: { estudiantes: { select: { id: true, nombres_apellidos: true, codigo_estudiante: true, escuela_profesional: true } } } });
    if (!tutor) return res.status(404).json({ error: "No encontrado" });

    const f01 = await prisma.estudiantes.count({ where: { tutor_asignado_id: id } });
    const f02 = await prisma.sesiones_grupales.count({ where: { tutor_id: id } });
    const f03 = await prisma.sesiones_tutoria.count({ where: { tutor_id: id, tipo_formato: 'F03' } });
    const f04 = await prisma.sesiones_tutoria.count({ where: { tutor_id: id, tipo_formato: 'F04' } });
    const f05 = await prisma.derivaciones.count({ where: { tutor_id: id } });
    const inf = await prisma.informes_semestrales.findFirst({ where: { tutor_id: id }, orderBy: { fecha_envio: 'desc' } });

    res.json({
        nombre: tutor.nombres_apellidos, programa: "Ingeniería de Sistemas",
        observaciones_informe: inf?.observaciones || "Sin observaciones.",
        lista_estudiantes: tutor.estudiantes,
        resumen_legajo: [{ tipo: 'F01', cantidad: f01 }, { tipo: 'F02', cantidad: f02 }, { tipo: 'F03', cantidad: f03 }, { tipo: 'F04', cantidad: f04 }, { tipo: 'F05', cantidad: f05 }]
    });
});

// LISTAR INFORMES (ADMIN) - CORREGIDO
app.get('/admin/informes', async (req, res) => {
    const informes = await prisma.informes_semestrales.findMany({ orderBy: { fecha_envio: 'desc' } });
    const tutores = await prisma.tutores.findMany({ select: { id: true, nombres_apellidos: true, codigo_docente: true } });
    res.json(informes.map(inf => ({ ...inf, tutor: tutores.find(t => t.id === inf.tutor_id) || { nombres_apellidos: 'Desconocido' } })));
});

app.patch('/admin/informes/:id/estado', async (req, res) => {
    await prisma.informes_semestrales.update({ where: { id: parseInt(req.params.id) }, data: { estado: req.body.estado } });
    res.json({ msg: "Estado actualizado" });
});

app.delete('/admin/informes/:id', async (req, res) => {
    await prisma.informes_semestrales.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ msg: "Eliminado" });
});

app.get('/tutores/:id/estado-informe', async (req, res) => {
    const inf = await prisma.informes_semestrales.findFirst({ where: { tutor_id: parseInt(req.params.id) } });
    res.json({ enviado: !!inf });
});

// 35. PORTAFOLIO ZIP (CORREGIDO PARA EVITAR ERROR 500)
app.get('/admin/tutor/:id/portafolio', verifyToken, async (req, res) => {
    console.log(`📥 Portafolio Tutor ID: ${req.params.id}`);
    try {
        const id = parseInt(req.params.id);
        const tutor = await prisma.tutores.findUnique({ where: { id } });
        if (!tutor) return res.status(404).json({ error: "Tutor no encontrado" });

        const asignaciones = await prisma.asignaciones.findMany({
            where: { tutor_id: id },
            include: {
                estudiante: { // IMPORTANTE: Usa 'estudiante', NO 'estudiante_rel'
                    include: {
                        sesiones_tutoria: { where: { tutor_id: id }, orderBy: { fecha: 'asc' } }
                    }
                }
            }
        });
        const estudiantes = asignaciones.map(a => a.estudiante).filter(e => e);
        res.json({ tutor, estudiantes });
    } catch (e) {
        console.error("❌ Error ZIP:", e);
        res.status(500).json({ error: "Error al generar portafolio", detalle: e.message });
    }
});

// CALENDARIO Y EVENTOS
app.get('/citas', verifyToken, async (req, res) => {
    const tutor = await prisma.tutores.findUnique({ where: { usuario_id: req.userId } });
    res.json(await prisma.calendario_tutorias.findMany({ where: { tutor_id: tutor.id }, include: { estudiantes: true } }));
});
app.post('/citas', verifyToken, async (req, res) => {
    const tutor = await prisma.tutores.findUnique({ where: { usuario_id: req.userId } });
    res.json(await prisma.calendario_tutorias.create({ data: { ...req.body, tutor_id: tutor.id, fecha_hora_inicio: new Date(req.body.inicio), fecha_hora_fin: new Date(req.body.fin) } }));
});
app.delete('/citas/:id', async (req, res) => {
    await prisma.calendario_tutorias.delete({ where: { id: parseInt(req.params.id) } }); res.json({ msg: "OK" });
});
app.get('/eventos', async (req, res) => {
    const { usuario_id, es_admin } = req.query;
    const where = es_admin === 'true' ? { tipo: 'GLOBAL' } : { OR: [{ tipo: 'GLOBAL' }, { AND: [{ tipo: 'PERSONAL' }, { creador_id: parseInt(usuario_id) }] }] };
    res.json(await prisma.eventos.findMany({ where }));
});
app.post('/eventos', async (req, res) => {
    res.json(await prisma.eventos.create({ data: { ...req.body, inicio: new Date(req.body.inicio), fin: new Date(req.body.fin), creador_id: parseInt(req.body.creador_id) } }));
});
app.delete('/eventos/:id', async (req, res) => {
    await prisma.eventos.delete({ where: { id: parseInt(req.params.id) } }); res.json({ msg: "OK" });
});
// 12. EDITAR SESIÓN POR ID (GENÉRICA)
app.put('/sesiones/:id', upload.none(), async (req, res) => {
    const { id } = req.params;
    // Extraemos datos y limpiamos undefined
    const { motivo_consulta, desarrollo_entrevista, acuerdos_compromisos, observaciones, resultado, firma_tutor_url, firma_estudiante_url } = req.body;

    try {
        const actualizado = await prisma.sesiones_tutoria.update({
            where: { id: parseInt(id) },
            data: {
                motivo_consulta,
                // Si desarrollo_entrevista es string JSON, lo guardamos tal cual
                desarrollo_entrevista, 
                acuerdos_compromisos,
                observaciones,
                resultado, // Para F03
                firma_tutor_url,
                firma_estudiante_url
            }
        });
        res.json({ message: "Sesión actualizada", data: actualizado });
    } catch (error) {
        console.error("Error PUT /sesiones/:id", error);
        res.status(500).json({ error: "No se pudo actualizar la sesión" });
    }
});
// INICIAR SERVIDOR
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});