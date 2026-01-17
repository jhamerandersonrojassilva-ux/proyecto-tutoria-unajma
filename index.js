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
//           RUTAS DEL SISTEMA
// ==========================================

// 1. LOGIN
app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const usuario = await prisma.usuarios.findFirst({
            where: { username, password_hash: password },
            include: {
                tutor: true,
                roles: true
            }
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
                asistencia_grupal: {
                    include: { sesion_grupal: true }
                }
            },
            orderBy: { nombres_apellidos: 'asc' }
        });

        const estudiantesProcesados = estudiantesRaw.map(est => {
            const sesionesUnificadas = [
                ...est.sesiones_tutoria.map(s => ({ ...s, tipo_formato: s.tipo_formato || 'F04' })),
                ...est.derivaciones.map(d => ({ ...d, tipo_formato: 'F05', fecha: d.fecha_solicitud })),
                ...est.asistencia_grupal.map(a => ({ ...a.sesion_grupal, tipo_formato: 'F02' }))
            ];
            sesionesUnificadas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            return {
                ...est,
                sesiones: sesionesUnificadas
            };
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
    console.log(`\n🔍 Consultando historial para Estudiante ID: ${estudianteId}`);

    try {
        const id = parseInt(estudianteId);

        const sesiones = await prisma.sesiones_tutoria.findMany({
            where: { estudiante_id: id },
            orderBy: { fecha: 'desc' }
        });

        const derivaciones = await prisma.derivaciones.findMany({
            where: { estudiante_id: id },
            orderBy: { fecha_solicitud: 'desc' }
        });

        const grupales = await prisma.asistencia_grupal.findMany({
            where: { estudiante_id: id },
            include: {
                sesion_grupal: {
                    include: { asistentes: { include: { estudiantes: true } } }
                }
            }
        });

        const historialCompleto = [
            ...sesiones.map(s => ({
                ...s,
                tipo_formato: s.tipo_formato || 'F04',
                firma_tutor_url: s.firma_tutor_url,
                firma_estudiante_url: s.firma_estudiante_url
            })),
            ...derivaciones.map(d => ({
                ...d,
                tipo_formato: 'F05',
                fecha: d.fecha_solicitud,
                firma_tutor_url: d.firma_tutor_url || d.firma_tutor
            })),
            ...grupales.map(g => ({
                ...g.sesion_grupal,
                tipo_formato: 'F02',
                id_asistencia: g.id,
                fecha: g.sesion_grupal.fecha,
                estudiantes_asistentes: g.sesion_grupal?.asistentes?.map(a => a.estudiantes) || []
            }))
        ].sort((a, b) => {
            const fechaA = new Date(a.fecha || a.fecha_solicitud || 0);
            const fechaB = new Date(b.fecha || b.fecha_solicitud || 0);
            return fechaB - fechaA;
        });

        res.json(historialCompleto);

    } catch (error) {
        console.error("❌ Error en GET /sesiones:", error.message);
        res.status(500).json({ error: "Error al cargar el historial" });
    }
});

// 4. CREAR TUTORÍA GRUPAL (F02)
app.post('/sesiones-grupales', upload.single('evidencia'), async (req, res) => {
    const { tema, fecha, hora_inicio, hora_cierre, area_tema, asistentes_ids, tutor_id, total_asignados, total_asistentes, firma_tutor_url } = req.body;
    let ids = [];
    try { ids = JSON.parse(asistentes_ids || "[]"); } catch (e) { return res.status(400).json({ error: "IDs inválidos" }); }

    try {
        const resultado = await prisma.$transaction(async (tx) => {
            const sesionMaestra = await tx.sesiones_grupales.create({
                data: {
                    tema,
                    fecha: new Date(fecha),
                    hora_inicio,
                    hora_cierre,
                    area_tema,
                    tutor_id: parseInt(tutor_id),
                    total_asignados: parseInt(total_asignados || 0),
                    total_asistentes: parseInt(total_asistentes || 0),
                    firma_tutor_url: firma_tutor_url,
                    evidencia_url: req.file ? `/uploads/evidencias/${req.file.filename}` : null
                }
            });

            if (ids.length > 0) {
                const asistencias = ids.map(estId => ({
                    estudiante_id: parseInt(estId),
                    sesion_grupal_id: sesionMaestra.id,
                    tipo_formato: 'F02'
                }));
                await tx.asistencia_grupal.createMany({ data: asistencias });
            }
            return sesionMaestra;
        });
        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. EDITAR TUTORÍA GRUPAL (F02)
app.put('/sesiones-grupales/:id', upload.single('evidencia'), async (req, res) => {
    const { id } = req.params;
    const { tema, fecha, hora_inicio, hora_cierre, area_tema, total_asignados, total_asistentes, asistentes_ids, firma_tutor_url } = req.body;

    try {
        let idsArray = [];
        try { idsArray = JSON.parse(asistentes_ids || "[]"); } catch (e) { idsArray = []; }

        let evidenciaPath = undefined;
        if (req.file) { evidenciaPath = `/uploads/evidencias/${req.file.filename}`; }

        const resultado = await prisma.$transaction(async (tx) => {
            const sesionActualizada = await tx.sesiones_grupales.update({
                where: { id: parseInt(id) },
                data: {
                    tema,
                    fecha: new Date(fecha),
                    hora_inicio,
                    hora_cierre,
                    area_tema,
                    total_asignados: parseInt(total_asignados || 0),
                    total_asistentes: parseInt(total_asistentes || 0),
                    firma_tutor_url: firma_tutor_url,
                    ...(evidenciaPath && { evidencia_url: evidenciaPath })
                }
            });

            await tx.asistencia_grupal.deleteMany({ where: { sesion_grupal_id: parseInt(id) } });

            if (idsArray.length > 0) {
                await tx.asistencia_grupal.createMany({
                    data: idsArray.map(estId => ({
                        sesion_grupal_id: parseInt(id),
                        estudiante_id: parseInt(estId),
                        tipo_formato: 'F02'
                    }))
                });
            }
            return sesionActualizada;
        });
        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar F02" });
    }
});

// 6. GUARDAR/ACTUALIZAR FICHA INTEGRAL (F01)
app.post('/sesiones-tutoria/f01', async (req, res) => {
    console.log("\n--- BACKEND: RECIBIENDO PETICIÓN F01 ---");
    const d = req.body;
    try {
        const resultado = await prisma.$transaction(async (tx) => {
            const estudianteId = parseInt(d.estudiante_id);
            const f01Existente = await tx.sesiones_tutoria.findFirst({
                where: { estudiante_id: estudianteId, tipo_formato: 'F01' }
            });

            const dataF01 = {
                tutor_id: parseInt(d.tutor_id),
                estudiante_id: estudianteId,
                tipo_formato: 'F01',
                fecha: new Date(),
                motivo_consulta: 'Ficha Integral',
                // Mapeo de campos...
                lugar_nacimiento: d.lugar_nacimiento,
                estado_civil: d.estado_civil,
                año_ingreso: d.año_ingreso,
                ciclo_actual: d.ciclo_actual,
                tel_emergencia: d.tel_emergencia,
                referencia_emergencia: d.referencia_emergencia,
                salud_enfermedad: d.salud_enfermedad,
                salud_enfermedad_cual: d.salud_enfermedad_cual,
                salud_cirugia: d.salud_cirugia,
                salud_cirugia_cual: d.salud_cirugia_cual,
                salud_medicamentos: d.salud_medicamentos,
                salud_medicamentos_cuales: d.salud_medicamentos_cuales,
                trabaja_actualmente: d.trabaja_actualmente,
                lugar_trabajo: d.lugar_trabajo,
                cargo_trabajo: d.cargo_trabajo,
                horario_trabajo: d.horario_trabajo,
                firma_tutor_url: d.firma_tutor_url,
                firma_estudiante_url: d.firma_estudiante_url,
                desarrollo_entrevista: d.desarrollo_entrevista,
                familiares: d.familiares || []
            };

            let sesionFinal;
            if (f01Existente) {
                sesionFinal = await tx.sesiones_tutoria.update({ where: { id: f01Existente.id }, data: dataF01 });
            } else {
                sesionFinal = await tx.sesiones_tutoria.create({ data: dataF01 });
            }

            // Sincronizar datos personales
            await tx.estudiantes.update({
                where: { id: estudianteId },
                data: {
                    telefono: d.telefono,
                    direccion_actual: d.direccion_actual,
                    ciclo_actual: d.ciclo_actual,
                    correo_institucional: d.correo_institucional,
                    fecha_nacimiento: d.fecha_nacimiento ? new Date(d.fecha_nacimiento) : undefined
                }
            });
            return sesionFinal;
        });

        res.json({ success: true, data: resultado });
    } catch (error) {
        console.error("❌ ERROR BACKEND F01:", error);
        res.status(500).json({ error: "Fallo en persistencia integral." });
    }
});

// 7. GUARDAR/ACTUALIZAR FICHA DE ENTREVISTA (F03)
app.post('/sesiones-tutoria/f03', async (req, res) => {
    const { id, estudiante_id, tutor_id, motivo_consulta, desarrollo_entrevista, acuerdos_compromisos, observaciones, firma_tutor_url, firma_estudiante_url } = req.body;
    try {
        let resultado;
        const dataComun = {
            motivo_consulta,
            desarrollo_entrevista,
            acuerdos_compromisos,
            observaciones,
            firma_tutor_url,
            firma_estudiante_url,
            fecha: new Date()
        };

        if (id) {
            resultado = await prisma.sesiones_tutoria.update({
                where: { id: parseInt(id) },
                data: dataComun
            });
            res.json({ message: "Entrevista actualizada correctamente", data: resultado });
        } else {
            resultado = await prisma.sesiones_tutoria.create({
                data: {
                    ...dataComun,
                    estudiante_id: parseInt(estudiante_id),
                    tutor_id: parseInt(tutor_id),
                    tipo_formato: 'F03'
                }
            });
            res.json({ message: "Entrevista registrada exitosamente", data: resultado });
        }
    } catch (error) {
        console.error("Error al guardar F03:", error);
        res.status(500).json({ error: "Error interno al guardar la entrevista." });
    }
});

// 8. GUARDAR/ACTUALIZAR FICHA DE SEGUIMIENTO (F04)
app.post('/sesiones-tutoria/f04', async (req, res) => {
    const { id, estudiante_id, tutor_id, fecha, motivo_consulta, desarrollo_entrevista, acuerdos_compromisos, observaciones, firma_tutor_url, firma_estudiante_url } = req.body;
    try {
        const fechaSesion = fecha ? new Date(fecha) : new Date();
        const dataComun = {
            fecha: fechaSesion,
            motivo_consulta,
            desarrollo_entrevista,
            acuerdos_compromisos,
            observaciones,
            firma_tutor_url,
            firma_estudiante_url
        };

        if (id) {
            const resultado = await prisma.sesiones_tutoria.update({
                where: { id: parseInt(id) },
                data: dataComun
            });
            res.json({ message: "Sesión F04 actualizada", data: resultado });
        } else {
            const resultado = await prisma.sesiones_tutoria.create({
                data: {
                    ...dataComun,
                    estudiante_id: parseInt(estudiante_id),
                    tutor_id: parseInt(tutor_id),
                    tipo_formato: 'F04'
                }
            });
            res.json({ message: "Sesión F04 registrada", data: resultado });
        }
    } catch (error) {
        console.error("Error F04:", error);
        res.status(500).json({ error: "Error al guardar la sesión de seguimiento." });
    }
});

// 9. CREAR DERIVACIÓN (F05)
app.post('/derivaciones', async (req, res) => {
    try {
        const d = req.body;
        const fechaFinal = d.fecha_manual || d.fecha_solicitud || d.fecha || new Date();
        const nueva = await prisma.derivaciones.create({
            data: {
                estudiante_id: parseInt(d.estudiante_id),
                tutor_id: parseInt(d.tutor_id),
                tipo_formato: 'F05',
                fecha_solicitud: new Date(fechaFinal),
                fecha_nacimiento: d.fecha_nacimiento ? new Date(d.fecha_nacimiento) : undefined,
                motivo_derivacion: d.motivo_derivacion || d.motivo_consulta || "Sin motivo",
                area_destino: d.area_destino || "No especificado",
                nombre_tutor_deriva: d.nombre_tutor || d.nombre_tutor_deriva,
                firma_tutor_url: d.firma_tutor_url,
                escuela_profesional: d.escuela_profesional,
                semestre: d.semestre || "No registrado",
                celular: d.celular,
                edad: d.edad ? parseInt(d.edad) : 0
            }
        });
        res.json({ message: "Derivación creada", data: nueva });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 10. ACTUALIZAR DERIVACIÓN (F05)
app.put('/derivaciones/:id', async (req, res) => {
    const { id } = req.params;
    const d = req.body;
    try {
        const fechaFinal = d.fecha_manual || d.fecha_solicitud || d.fecha;
        const actualizada = await prisma.derivaciones.update({
            where: { id: parseInt(id) },
            data: {
                fecha_solicitud: new Date(fechaFinal),
                fecha_nacimiento: d.fecha_nacimiento ? new Date(d.fecha_nacimiento) : undefined,
                motivo_derivacion: d.motivo_derivacion || d.motivo_consulta,
                area_destino: d.area_destino,
                nombre_tutor_deriva: d.nombre_tutor || d.nombre_tutor_deriva,
                firma_tutor_url: d.firma_tutor_url,
                escuela_profesional: d.escuela_profesional,
                semestre: d.semestre,
                celular: d.celular,
                edad: d.edad ? parseInt(d.edad) : 0
            }
        });
        res.json({ message: "Derivación actualizada", data: actualizada });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 11. ELIMINAR SESIONES/REGISTROS
app.delete('/sesiones/:id', async (req, res) => {
    try {
        await prisma.sesiones_tutoria.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: "Sesión eliminada correctamente" });
    } catch (error) {
        if (error.code === 'P2025') return res.status(404).json({ error: "Registro no existe" });
        res.status(500).json({ error: "Error interno al eliminar" });
    }
});

app.delete('/sesiones-grupales/:id', async (req, res) => {
    try {
        await prisma.sesiones_grupales.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: "Sesión grupal eliminada" });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar F02" });
    }
});

app.delete('/derivaciones/:id', async (req, res) => {
    try {
        await prisma.derivaciones.deleteMany({ where: { id: parseInt(req.params.id) } });
        res.json({ message: "Eliminado" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 12. CALENDARIO: OBTENER CITAS
app.get('/citas', verifyToken, async (req, res) => {
    try {
        const tutor = await prisma.tutores.findUnique({ where: { usuario_id: req.userId } });
        if (!tutor) return res.status(404).json({ error: "Tutor no encontrado" });

        const citas = await prisma.calendario_tutorias.findMany({
            where: { tutor_id: tutor.id },
            include: {
                estudiantes: {
                    select: {
                        id: true, nombres_apellidos: true, telefono: true, codigo_estudiante: true,
                        sesiones_tutoria: { where: { tipo_formato: 'F01' }, take: 1, select: { desarrollo_entrevista: true } }
                    }
                }
            }
        });
        res.json(citas);
    } catch (error) { res.status(500).json({ error: "Error al cargar citas" }); }
});

// 13. CALENDARIO: CREAR/BORRAR
app.post('/citas', verifyToken, async (req, res) => {
    try {
        const { estudiante_id, titulo, inicio, fin, lugar, enlace } = req.body;
        const tutor = await prisma.tutores.findUnique({ where: { usuario_id: req.userId } });
        const nuevaCita = await prisma.calendario_tutorias.create({
            data: {
                tutor_id: tutor.id,
                estudiante_id: parseInt(estudiante_id),
                titulo_cita: titulo,
                fecha_hora_inicio: new Date(inicio),
                fecha_hora_fin: new Date(fin),
                lugar: lugar || "Oficina de Tutoría",
                enlace_virtual: enlace || "",
                estado: "Programada"
            }
        });
        res.json(nuevaCita);
    } catch (error) { res.status(500).json({ error: "Error al crear cita" }); }
});

app.delete('/citas/:id', async (req, res) => {
    try {
        await prisma.calendario_tutorias.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Error al eliminar" }); }
});

// ==========================================
//          RUTAS DE ADMINISTRACIÓN
// ==========================================

// 14. GESTIÓN DE CICLOS
app.get('/admin/ciclos', async (req, res) => {
    const ciclos = await prisma.ciclos.findMany({ orderBy: { id: 'desc' } });
    res.json(ciclos);
});

app.post('/admin/ciclos', async (req, res) => {
    try {
        const nuevoCiclo = await prisma.ciclos.create({ data: { nombre_ciclo: req.body.nombre_ciclo, activo: true } });
        res.status(201).json(nuevoCiclo);
    } catch (error) { res.status(500).json({ error: "Error al crear ciclo" }); }
});

app.patch('/admin/ciclos/:id/activar', async (req, res) => {
    try {
        await prisma.$transaction([
            prisma.ciclos.updateMany({ data: { activo: false } }),
            prisma.ciclos.update({ where: { id: parseInt(req.params.id) }, data: { activo: true } })
        ]);
        res.json({ mensaje: "Ciclo activado" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/ciclos/:id', async (req, res) => {
    try {
        const ciclo = await prisma.ciclos.update({ where: { id: parseInt(req.params.id) }, data: { nombre_ciclo: req.body.nombre_ciclo } });
        res.json(ciclo);
    } catch (error) { res.status(500).json({ error: "Error al actualizar" }); }
});

app.delete('/admin/ciclos/:id', async (req, res) => {
    try {
        const asignaciones = await prisma.asignaciones.count({ where: { ciclo_id: parseInt(req.params.id) } });
        if (asignaciones > 0) return res.status(400).json({ error: "Hay alumnos matriculados en este ciclo." });
        await prisma.ciclos.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: "Ciclo eliminado" });
    } catch (error) { res.status(500).json({ error: "Error al eliminar" }); }
});

// 15. GESTIÓN DE TUTORES (CRUD + Completo)
app.get('/tutores', async (req, res) => {
    try {
        const tutores = await prisma.tutores.findMany({
            where: { activo: true },
            include: { usuario: true },
            orderBy: { nombres_apellidos: 'asc' }
        });
        res.json(tutores);
    } catch (error) { res.status(500).json({ error: "Error al cargar tutores" }); }
});

app.post('/admin/tutores-completo', async (req, res) => {
    const { nombres, dni, codigo, correo, especialidad, telefono, rol_id } = req.body;
    try {
        const resultado = await prisma.$transaction(async (tx) => {
            const usuario = await tx.usuarios.create({
                data: {
                    username: dni,
                    password_hash: dni,
                    rol_id: parseInt(rol_id),
                    telefono: telefono,
                    activo: true
                }
            });
            const tutor = await tx.tutores.create({
                data: {
                    nombres_apellidos: nombres,
                    dni: dni,
                    codigo_docente: codigo,
                    correo_institucional: correo,
                    especialidad: especialidad,
                    usuario_id: usuario.id,
                    activo: true
                }
            });
            return { usuario, tutor };
        });
        res.status(201).json(resultado);
    } catch (error) { res.status(500).json({ error: "Error al crear tutor (DNI/Código duplicado)" }); }
});

app.put('/admin/tutores/:id', async (req, res) => {
    const { id } = req.params;
    const { nombres, codigo, correo, especialidad, telefono } = req.body;
    try {
        await prisma.$transaction(async (tx) => {
            const tutor = await tx.tutores.update({
                where: { id: parseInt(id) },
                data: { nombres_apellidos: nombres, codigo_docente: codigo, correo_institucional: correo, especialidad: especialidad }
            });
            if (tutor.usuario_id) {
                await tx.usuarios.update({ where: { id: tutor.usuario_id }, data: { telefono: telefono } });
            }
        });
        res.json({ message: "Tutor actualizado" });
    } catch (error) { res.status(500).json({ error: "Error al actualizar" }); }
});

app.delete('/admin/tutores/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const asignaciones = await prisma.estudiantes.count({ where: { tutor_asignado_id: parseInt(id) } });
        if (asignaciones > 0) return res.status(400).json({ error: "El tutor tiene estudiantes asignados." });
        const tutor = await prisma.tutores.findUnique({ where: { id: parseInt(id) } });
        await prisma.$transaction(async (tx) => {
            await tx.tutores.delete({ where: { id: parseInt(id) } });
            if (tutor && tutor.usuario_id) await tx.usuarios.delete({ where: { id: tutor.usuario_id } });
        });
        res.json({ message: "Eliminado correctamente" });
    } catch (error) { res.status(500).json({ error: "Error al eliminar" }); }
});

// 16. OBTENER ROLES
app.get('/roles', async (req, res) => {
    try {
        const roles = await prisma.roles.findMany();
        res.json(roles);
    } catch (error) { res.status(500).json({ error: "Error roles" }); }
});

// 17. CARGA MASIVA DE ESTUDIANTES
app.post('/admin/carga-masiva-estudiantes', async (req, res) => {
    const { estudiantes, tutor_id, ciclo_id } = req.body;
    try {
        const transaccion = await prisma.$transaction(async (tx) => {
            const resultados = [];
            for (const est of estudiantes) {
                const estudiante = await tx.estudiantes.upsert({
                    where: { dni: est.dni.toString() },
                    update: {
                        nombres_apellidos: est.nombres_apellidos,
                        codigo_estudiante: est.codigo.toString(),
                        escuela_profesional: est.escuela || 'Ingeniería de Sistemas',
                        tutor_asignado_id: parseInt(tutor_id)
                    },
                    create: {
                        nombres_apellidos: est.nombres_apellidos,
                        dni: est.dni.toString(),
                        codigo_estudiante: est.codigo.toString(),
                        escuela_profesional: est.escuela || 'Ingeniería de Sistemas',
                        tutor_asignado_id: parseInt(tutor_id)
                    }
                });

                const asignacionExistente = await tx.asignaciones.findFirst({
                    where: { estudiante_id: estudiante.id, ciclo_id: parseInt(ciclo_id) }
                });

                if (asignacionExistente) {
                    await tx.asignaciones.update({ where: { id: asignacionExistente.id }, data: { tutor_id: parseInt(tutor_id) } });
                } else {
                    await tx.asignaciones.create({
                        data: { tutor_id: parseInt(tutor_id), estudiante_id: estudiante.id, ciclo_id: parseInt(ciclo_id) }
                    });
                }
                resultados.push(estudiante);
            }
            return resultados;
        });
        res.json({ mensaje: `Procesados ${transaccion.length} estudiantes.`, data: transaccion });
    } catch (error) {
        if (error.code === 'P2002') res.status(400).json({ error: "Códigos duplicados en el Excel." });
        else res.status(500).json({ error: "Error interno carga masiva" });
    }
});

// 18. GESTIÓN DE ESTUDIANTES (Busqueda, Reasignación, Edición)
app.get('/admin/estudiantes/buscar', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    try {
        const estudiantes = await prisma.estudiantes.findMany({
            where: {
                OR: [
                    { nombres_apellidos: { contains: q } },
                    { dni: { contains: q.toString() } },
                    { codigo_estudiante: { contains: q.toString() } }
                ]
            },
            take: 10
        });
        res.json(estudiantes);
    } catch (error) { res.status(500).json({ error: "Error al buscar" }); }
});

app.put('/admin/estudiantes/reasignar', async (req, res) => {
    const { estudiante_id, nuevo_tutor_id, ciclo_id } = req.body;
    try {
        await prisma.$transaction(async (tx) => {
            await tx.estudiantes.update({
                where: { id: parseInt(estudiante_id) },
                data: { tutor_asignado_id: parseInt(nuevo_tutor_id) }
            });
            const asignacion = await tx.asignaciones.findFirst({
                where: { estudiante_id: parseInt(estudiante_id), ciclo_id: parseInt(ciclo_id) }
            });
            if (asignacion) {
                await tx.asignaciones.update({ where: { id: asignacion.id }, data: { tutor_id: parseInt(nuevo_tutor_id) } });
            } else {
                await tx.asignaciones.create({
                    data: { estudiante_id: parseInt(estudiante_id), tutor_id: parseInt(nuevo_tutor_id), ciclo_id: parseInt(ciclo_id) }
                });
            }
        });
        res.json({ message: "Traslado exitoso" });
    } catch (error) { res.status(500).json({ error: "Error al reasignar" }); }
});

app.put('/admin/estudiantes/:id', async (req, res) => {
    const { id } = req.params;
    const { nombres, dni, codigo, tutor_id, ciclo_id, telefono } = req.body;
    try {
        await prisma.$transaction(async (tx) => {
            await tx.estudiantes.update({
                where: { id: parseInt(id) },
                data: {
                    nombres_apellidos: nombres,
                    dni: dni.toString(),
                    codigo_estudiante: codigo.toString(),
                    telefono: telefono || null,
                    tutor_asignado_id: parseInt(tutor_id)
                }
            });
            const asignacion = await tx.asignaciones.findFirst({
                where: { estudiante_id: parseInt(id), ciclo_id: parseInt(ciclo_id) }
            });
            if (asignacion) {
                await tx.asignaciones.update({ where: { id: asignacion.id }, data: { tutor_id: parseInt(tutor_id) } });
            } else {
                await tx.asignaciones.create({
                    data: { estudiante_id: parseInt(id), tutor_id: parseInt(tutor_id), ciclo_id: parseInt(ciclo_id) }
                });
            }
        });
        res.json({ message: "Estudiante actualizado" });
    } catch (error) { res.status(500).json({ error: "Error al actualizar (posible duplicado)" }); }
});

app.get('/admin/tutores/:id/estudiantes', async (req, res) => {
    try {
        const estudiantes = await prisma.estudiantes.findMany({
            where: { tutor_asignado_id: parseInt(req.params.id) },
            select: { id: true, nombres_apellidos: true, codigo_estudiante: true, dni: true, escuela_profesional: true },
            orderBy: { nombres_apellidos: 'asc' }
        });
        res.json(estudiantes || []);
    } catch (error) { res.status(500).json({ error: "Error lista estudiantes" }); }
});

// 19. NOTIFICACIONES WHATSAPP
app.get('/admin/notificaciones-asignacion', async (req, res) => {
    try {
        const estudiantes = await prisma.estudiantes.findMany({
            where: { tutor_asignado_id: { not: null } },
            orderBy: { nombres_apellidos: 'asc' }
        });
        const tutores = await prisma.tutores.findMany();
        const lista = estudiantes.map(e => {
            const elTutor = tutores.find(t => t.id === e.tutor_asignado_id);
            return {
                id: e.id,
                estudiante: e.nombres_apellidos,
                telefono: e.telefono || '',
                tutor: elTutor ? elTutor.nombres_apellidos : '---',
                codigo: e.codigo_estudiante
            };
        });
        res.json(lista);
    } catch (error) { res.status(500).json({ error: "Error notificaciones" }); }
});

app.patch('/admin/estudiantes/:id/telefono', async (req, res) => {
    try {
        await prisma.estudiantes.update({
            where: { id: parseInt(req.params.id) },
            data: { telefono: req.body.telefono }
        });
        res.json({ message: "Teléfono actualizado" });
    } catch (error) { res.status(500).json({ error: "Error al actualizar teléfono" }); }
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

// 21. EVENTOS (CRUD)
app.get('/eventos', async (req, res) => {
    const { usuario_id, es_admin } = req.query;
    try {
        let filtro = {};
        if (es_admin === 'true') {
            filtro = { tipo: 'GLOBAL' };
        } else {
            filtro = {
                OR: [
                    { tipo: 'GLOBAL' },
                    { AND: [{ tipo: 'PERSONAL' }, { creador_id: parseInt(usuario_id) }] }
                ]
            };
        }
        const eventos = await prisma.eventos.findMany({ where: filtro });
        res.json(eventos);
    } catch (error) { res.status(500).json({ error: "Error eventos" }); }
});

app.post('/eventos', async (req, res) => {
    try {
        const { titulo, inicio, fin, tipo, creador_id, color } = req.body;
        const evento = await prisma.eventos.create({
            data: { titulo, inicio: new Date(inicio), fin: new Date(fin), tipo, creador_id: parseInt(creador_id), color }
        });
        res.json(evento);
    } catch (error) { res.status(500).json({ error: "Error al crear evento" }); }
});

app.put('/eventos/:id', async (req, res) => {
    try {
        const { titulo, inicio, fin, color } = req.body;
        const evento = await prisma.eventos.update({
            where: { id: parseInt(req.params.id) },
            data: { titulo, inicio: new Date(inicio), fin: new Date(fin), color }
        });
        res.json(evento);
    } catch (error) { res.status(500).json({ error: "Error al actualizar evento" }); }
});

app.delete('/eventos/:id', async (req, res) => {
    try {
        await prisma.eventos.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: "Evento eliminado" });
    } catch (error) { res.status(500).json({ error: "Error al eliminar" }); }
});

// ==========================================
//          RUTAS DE REPORTES (FIXED)
// ==========================================

// 22. REMITIR INFORME (TUTOR) - CORREGIDO (USANDO PRISMA)
// 22. REMITIR INFORME (TUTOR) - ACTUALIZADO CON ARCHIVO ADJUNTO
app.post('/tutores/remitir-ciclo', upload.single('informe_adjunto'), async (req, res) => {
  try {
    // Cuando se envía un archivo, los datos vienen en req.body como strings
    const { 
      tutor_id, 
      semestre, 
      total_estudiantes, 
      total_atendidos, 
      total_riesgo, 
      avance, 
      observaciones 
    } = req.body;

    console.log("📝 Recibiendo informe con archivo:", req.body);

    if (!tutor_id) return res.status(400).json({ error: "Falta el ID del tutor." });

    // Procesar el archivo si existe
    let rutaArchivo = null;
    if (req.file) {
        rutaArchivo = `/uploads/evidencias/${req.file.filename}`;
    }

    const nuevoInforme = await prisma.informes_semestrales.create({
      data: {
        tutor_id: parseInt(tutor_id),
        semestre: semestre || '2025-I',
        total_estudiantes: parseInt(total_estudiantes) || 0,
        total_atendidos: parseInt(total_atendidos) || 0,
        total_riesgo: parseInt(total_riesgo) || 0,
        avance_porcentaje: parseInt(avance) || 0,
        observaciones: observaciones || '',
        estado: 'ENVIADO',
        fecha_envio: new Date(),
        archivo_url: rutaArchivo // <--- Guardamos la ruta aquí
      }
    });
    
    console.log("✅ Informe guardado con adjunto:", nuevoInforme);
    res.status(200).json({ message: "Informe remitido con éxito", data: nuevoInforme });

  } catch (err) {
    console.error("❌ Error CRÍTICO al guardar informe:", err);
    res.status(500).json({ error: "Error interno", detalle: err.message });
  }
});

// 23. SEGUIMIENTO REMISIONES (ADMIN) - CORREGIDO (PRISMA RAW)
app.get('/admin/seguimiento-remisiones', async (req, res) => {
    try {
        // Usamos raw query para unir con la tabla usuarios o tutores y obtener el nombre
        // Ajustamos para unir con 'tutores' que tiene 'nombres_apellidos'
        const sql = `
            SELECT i.*, u.nombres_apellidos AS nombre_tutor 
            FROM informes_semestrales i
            JOIN tutores u ON i.tutor_id = u.id
            ORDER BY i.fecha_envio DESC
        `;
        
        // Prisma Client permite queries raw, reemplazando a db.query
        const result = await prisma.$queryRawUnsafe(sql);
        
        // Serializamos BigInt si existiera (Postgres count retorna BigInt a veces)
        const data = JSON.parse(JSON.stringify(result, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        res.json(data);
    } catch (error) {
        console.error("Error al obtener remisiones:", error);
        res.status(500).json({ error: "Error al obtener los datos." });
    }
});

// 24. RESUMEN LEGAJO
app.get('/admin/resumen-legajo/:tutor_id', async (req, res) => {
    try {
        const idTutor = parseInt(req.params.tutor_id);
        const sesionesIndividuales = await prisma.sesiones_tutoria.groupBy({
            by: ['tipo_formato'],
            where: { tutor_id: idTutor },
            _count: { id: true }
        });
        const totalF02 = await prisma.sesiones_grupales.count({ where: { tutor_id: idTutor } });
        const totalF05 = await prisma.derivaciones.count({ where: { tutor_id: idTutor } });

        const resumen = [
            { tipo: 'F01', cantidad: sesionesIndividuales.find(s => s.tipo_formato === 'F01')?._count.id || 0 },
            { tipo: 'F02', cantidad: totalF02 },
            { tipo: 'F03', cantidad: sesionesIndividuales.find(s => s.tipo_formato === 'F03')?._count.id || 0 },
            { tipo: 'F04', cantidad: sesionesIndividuales.find(s => s.tipo_formato === 'F04')?._count.id || 0 },
            { tipo: 'F05', cantidad: totalF05 }
        ];
        res.json(resumen);
    } catch (error) { res.status(500).json({ error: "Error resumen" }); }
});
// 24. DATA PARA REPORTE CONSOLIDADO (ADMIN) - VERSIÓN MEJORADA
// 24. DATA PARA REPORTE CONSOLIDADO (ADMIN) - VERSIÓN MEJORADA
app.get('/admin/reporte-consolidado/:tutor_id', async (req, res) => {
    const { tutor_id } = req.params;
    try {
        const id = parseInt(tutor_id);

        // 1. Obtener datos del Tutor y sus Estudiantes asignados
        const tutor = await prisma.tutores.findUnique({
            where: { id: id },
            include: {
                estudiantes: {
                    select: {
                        id: true,
                        nombres_apellidos: true,
                        codigo_estudiante: true,
                        escuela_profesional: true
                    }
                }
            }
        });

        if (!tutor) return res.status(404).json({ error: "Tutor no encontrado" });

        // 2. Calcular conteos reales en la Base de Datos
        // F01: Estudiantes asignados (Asumimos que todos deben tener ficha)
        const f01_count = await prisma.estudiantes.count({ where: { tutor_asignado_id: id } });

        // F02: Sesiones Grupales creadas por el tutor
        const f02_count = await prisma.sesiones_grupales.count({ where: { tutor_id: id } });

        // F03: Entrevistas (Sesiones tipo F03)
        const f03_count = await prisma.sesiones_tutoria.count({ 
            where: { tutor_id: id, tipo_formato: 'F03' } 
        });

        // F04: Sesiones de Seguimiento (Tipo F04)
        const f04_count = await prisma.sesiones_tutoria.count({ 
            where: { tutor_id: id, tipo_formato: 'F04' } 
        });

        // F05: Derivaciones realizadas
        const f05_count = await prisma.derivaciones.count({ where: { tutor_id: id } });

        // 3. Buscar las observaciones del último informe enviado
        const ultimoInforme = await prisma.informes_semestrales.findFirst({
            where: { tutor_id: id },
            orderBy: { fecha_envio: 'desc' }
        });

        // 4. Enviar todo empaquetado al Frontend
        res.json({
            nombre: tutor.nombres_apellidos,
            programa: tutor.estudiantes[0]?.escuela_profesional || "Ingeniería de Sistemas",
            observaciones_informe: ultimoInforme?.observaciones || "Sin observaciones registradas.",
            lista_estudiantes: tutor.estudiantes, // <--- ESTO ES NUEVO Y VALIOSO
            resumen_legajo: [
                { tipo: 'F01', cantidad: f01_count },
                { tipo: 'F02', cantidad: f02_count },
                { tipo: 'F03', cantidad: f03_count },
                { tipo: 'F04', cantidad: f04_count },
                { tipo: 'F05', cantidad: f05_count },
            ]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al generar reporte" });
    }
});
// --- PEGAR AL FINAL DE index.js (ANTES DE app.listen) ---

// 25. GESTIONAR ESTADO DEL INFORME (ADMIN: APROBAR / OBSERVAR)
app.patch('/admin/informes/:id/estado', async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body; // 'APROBADO', 'OBSERVADO', 'ENVIADO'

    try {
        const informeActualizado = await prisma.informes_semestrales.update({
            where: { id: parseInt(id) },
            data: { estado: estado }
        });
        res.json({ message: `Informe marcado como ${estado}`, data: informeActualizado });
    } catch (error) {
        console.error("Error al cambiar estado:", error);
        res.status(500).json({ error: "No se pudo actualizar el estado" });
    }
});

// 26. ELIMINAR INFORME (ADMIN)
app.delete('/admin/informes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.informes_semestrales.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: "Informe eliminado correctamente" });
    } catch (error) {
        console.error("Error al eliminar informe:", error);
        res.status(500).json({ error: "No se pudo eliminar el informe" });
    }
});

// --- PEGAR AL FINAL DE index.js (ANTES DE app.listen) ---

// 25. CAMBIAR ESTADO DEL INFORME (Aprobar / Observar)
app.patch('/admin/informes/:id/estado', async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body; // Recibimos 'APROBADO' u 'OBSERVADO'

    try {
        const informeActualizado = await prisma.informes_semestrales.update({
            where: { id: parseInt(id) },
            data: { estado: estado }
        });
        res.json({ message: `Estado actualizado a ${estado}`, data: informeActualizado });
    } catch (error) {
        console.error("Error al cambiar estado:", error);
        res.status(500).json({ error: "No se pudo actualizar el estado" });
    }
});

// 26. ELIMINAR INFORME
app.delete('/admin/informes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.informes_semestrales.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: "Informe eliminado correctamente" });
    } catch (error) {
        console.error("Error al eliminar informe:", error);
        res.status(500).json({ error: "No se pudo eliminar el informe" });
    }
});
// --- PEGAR AL FINAL DE index.js ---

// 34. VERIFICAR SI TUTOR YA REMITIÓ INFORME
app.get('/tutores/:id/estado-informe', async (req, res) => {
    const { id } = req.params;
    try {
        const informe = await prisma.informes_semestrales.findFirst({
            where: { 
                tutor_id: parseInt(id),
                // Opcional: filtrar por semestre si lo manejas dinámico
                // semestre: '2025-I' 
            }
        });
        
        // Retorna true si encontró un informe, false si no
        res.json({ enviado: !!informe }); 
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al verificar estado" });
    }
});

// --- NUEVA RUTA: LISTAR TODOS LOS INFORMES RECIBIDOS (PARA EL ADMIN) ---
// --- NUEVA RUTA CORREGIDA: LISTAR INFORMES (Manual Join) ---
// --- RUTA CORREGIDA: LISTAR INFORMES (Sin error de Prisma) ---
app.get('/admin/informes', async (req, res) => {
    try {
        // 1. Obtenemos los informes sin 'include' para evitar errores de relación
        const informes = await prisma.informes_semestrales.findMany({
            orderBy: { fecha_envio: 'desc' }
        });

        // 2. Obtenemos manualmente los datos de los tutores
        // (Esto simula el 'include' pero sin fallar si la relación no es estricta)
        const tutorIds = [...new Set(informes.map(i => i.tutor_id))];
        const tutores = await prisma.tutores.findMany({
            where: { id: { in: tutorIds } },
            select: { id: true, nombres_apellidos: true, codigo_docente: true }
        });

        // 3. Unimos los datos nosotros mismos
        const resultado = informes.map(informe => {
            const tutorInfo = tutores.find(t => t.id === informe.tutor_id);
            return {
                ...informe,
                tutor: tutorInfo || { nombres_apellidos: 'Docente no encontrado', codigo_docente: '---' }
            };
        });

        res.json(resultado);
    } catch (error) {
        console.error("Error al listar informes:", error);
        res.status(500).json({ error: "Error interno al obtener informes" });
    }
});
// INICIAR SERVIDOR





app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});