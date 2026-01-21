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
const prisma = new PrismaClient(); 
const PORT = process.env.PORT || 3001;
const SECRET_KEY = 'secret_key';

// --- MIDDLEWARES GLOBALES ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS ---
// Aseguramos que existan las carpetas necesarias
const folders = ['uploads', 'uploads/evidencias'];
folders.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Permitir acceso público a la carpeta uploads para descargar PDFs
app.use('/uploads', express.static('uploads'));

// --- CONFIGURACIÓN MULTER (SUBIDA DE ARCHIVOS) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Guardamos todo en 'uploads/' para facilitar las rutas
        cb(null, 'uploads/'); 
    },
    filename: (req, file, cb) => {
        // Generamos nombre único: TIPO-TIMESTAMP-NOMBRE
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'DOC-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- MIDDLEWARE DE VERIFICACIÓN DE TOKEN ---
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(403).json({ error: "No se proporcionó token de seguridad" });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Token inválido o expirado" });
        // Extraemos TODOS los datos del payload del token
        req.userId = decoded.id;
        req.userRol = decoded.rol;
        req.escuelaId = decoded.escuela_id;
        req.isSuperUser = decoded.super_user;
        next();
    });
};

// ==========================================
//          RUTAS DE AUTENTICACIÓN
// ==========================================

// 1. LOGIN
app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const usuario = await prisma.usuarios.findFirst({
            where: { username, password_hash: password },
            include: {
                tutor: true,
                roles: true,
                escuela: true
            }
        });

        if (usuario) {
            const token = jwt.sign(
                {
                    id: usuario.id,
                    rol: usuario.roles?.nombre_rol,
                    escuela_id: usuario.escuela_id,
                    super_user: usuario.super_user
                },
                SECRET_KEY,
                { expiresIn: '8h' }
            );

            res.json({
                id: usuario.id,
                username: usuario.username,
                roles: usuario.roles,
                tutor_id: usuario.tutor?.id || null,
                nombre: usuario.tutor?.nombres_apellidos || usuario.username,
                escuela_id: usuario.escuela_id,
                escuela_nombre: usuario.escuela?.nombre || "No asignada",
                is_super_user: usuario.super_user,
                token: token
            });
        } else {
            res.status(401).json({ error: "Credenciales incorrectas" });
        }
    } catch (error) {
        console.error("Error en Login:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// 2. CAMBIAR CONTRASEÑA
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
//          RUTAS DE GESTIÓN ACADÉMICA
// ==========================================

// 3. OBTENER LISTA DE ESTUDIANTES (DASHBOARD)
app.get('/estudiantes', verifyToken, async (req, res) => {
    try {
        const { userId, userRol, escuelaId, isSuperUser } = req;
        const { escuela_id: queryEscuelaId, tutor_id: queryTutorId } = req.query;

        let filtro = {};

        // Lógica de Filtrado: Directora/Admin vs Tutor
        if (isSuperUser || userRol === 'ADMIN' || userRol === 'ADMIN_TUTORIA' || queryEscuelaId) {
            const idEscuela = queryEscuelaId || escuelaId;
            if (!idEscuela) return res.json([]); 
            filtro = { escuela_id: parseInt(idEscuela) };
        } else {
            // Es Tutor: Buscamos su perfil
            const tutor = await prisma.tutores.findUnique({ where: { usuario_id: userId } });
            if (!tutor) return res.json([]);
            filtro = { tutor_asignado_id: tutor.id };
        }

        const estudiantesRaw = await prisma.estudiantes.findMany({
            where: filtro,
            include: {
                sesiones_tutoria: true,
                derivaciones: true,
                asistencia_grupal: { include: { sesion_grupal: true } },
                tutores: true
            },
            orderBy: { nombres_apellidos: 'asc' }
        });

        // Procesamiento de historial unificado
        const estudiantesProcesados = estudiantesRaw.map(est => {
            const sesionesUnificadas = [
                ...est.sesiones_tutoria.map(s => ({ ...s, tipo_formato: s.tipo_formato || 'F04', fecha: s.fecha })),
                ...est.derivaciones.map(d => ({ ...d, tipo_formato: 'F05', fecha: d.fecha_solicitud })),
                ...est.asistencia_grupal.map(a => a.sesion_grupal ? { ...a.sesion_grupal, tipo_formato: 'F02', fecha: a.sesion_grupal.fecha } : null).filter(Boolean)
            ].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

            return { ...est, sesiones: sesionesUnificadas };
        });

        res.json(estudiantesProcesados);
    } catch (error) {
        console.error("Error en /estudiantes:", error);
        res.status(500).json({ error: "Error interno" });
    }
});

// 4. HISTORIAL DE SESIONES POR ALUMNO
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
//          CALENDARIO (BLINDADO)
// ==========================================

app.get('/eventos', async (req, res) => {
    try {
        const { usuario_id } = req.query;
        if (!usuario_id || usuario_id === 'undefined') return res.json([]);

        const tutor = await prisma.tutores.findUnique({ 
            where: { usuario_id: parseInt(usuario_id) } 
        });

        // CRÍTICO: Si no es tutor (Directora), retornamos vacío para no crashear
        if (!tutor) {
            console.log(`[INFO] Usuario ${usuario_id} sin perfil de tutor accedió al calendario.`);
            return res.json([]);
        }

        const eventos = await prisma.calendario_tutorias.findMany({ 
            where: { tutor_id: tutor.id }, 
            include: { estudiantes: true } 
        });
        res.json(eventos);
    } catch (error) {
        console.error("Error en /eventos:", error.message);
        res.status(500).json({ error: "Error interno" });
    }
});

app.get('/citas', verifyToken, async (req, res) => {
    try {
        const tutor = await prisma.tutores.findUnique({ where: { usuario_id: req.userId } });
        
        // CRÍTICO: Protección para Directora
        if (!tutor) return res.json([]);

        const citas = await prisma.calendario_tutorias.findMany({ 
            where: { tutor_id: tutor.id }, 
            include: { estudiantes: true } 
        });
        res.json(citas);
    } catch (error) {
        res.status(500).json({ error: "Error interno" });
    }
});

app.post('/citas', verifyToken, async (req, res) => {
    try {
        const tutor = await prisma.tutores.findUnique({ where: { usuario_id: req.userId } });
        if (!tutor) return res.status(400).json({error: "No eres tutor"});
        
        res.json(await prisma.calendario_tutorias.create({ 
            data: { 
                ...req.body, 
                tutor_id: tutor.id, 
                fecha_hora_inicio: new Date(req.body.inicio), 
                fecha_hora_fin: new Date(req.body.fin) 
            } 
        }));
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/citas/:id', async (req, res) => {
    await prisma.calendario_tutorias.delete({ where: { id: parseInt(req.params.id) } }); 
    res.json({ msg: "OK" });
});

// ==========================================
//          RUTAS DE ADMINISTRACIÓN (DIRECTORA)
// ==========================================

// 5. REGISTRAR RESPONSABLE (CON PDF)
app.post('/admin/registrar-responsable', verifyToken, upload.single('documento'), async (req, res) => {
    try {
        const { username, password, telefono, escuela_id } = req.body;
        
        // Verificamos duplicados
        const existe = await prisma.usuarios.findUnique({ where: { username } });
        if (existe) return res.status(400).json({ error: "El usuario ya existe" });

        // NOTA: Guardamos password directa para compatibilidad con el Login actual.
        // Se ha removido bcrypt porque no lo tienes instalado y generaba error.
        
        await prisma.usuarios.create({
            data: {
                username,
                password_hash: password, // Texto plano (igual que en Login)
                telefono,
                escuela_id: parseInt(escuela_id),
                rol_id: 1, // Asumiendo ID 1 es ADMIN
                is_super_user: false,
                url_documento: req.file ? `/uploads/${req.file.filename}` : null
            }
        });
        res.json({ message: "Responsable registrado correctamente" });
    } catch (error) {
        console.error("Error registrando responsable:", error);
        res.status(500).json({ error: "Error al registrar" });
    }
});

// 6. LISTAR RESPONSABLES (SOLUCIONADO ERROR 500)
// IMPORTANTE: Requiere que hayas ejecutado 'npx prisma db push' para crear 'url_documento'
app.get('/admin/listar-responsables', verifyToken, async (req, res) => {
    try {
        const { escuela_id } = req.query;
        // Solo Directora o Admin pueden ver esto
        if (!req.isSuperUser && req.userRol !== 'ADMIN') {
            return res.status(403).json({ error: "Sin permisos" });
        }

        const responsables = await prisma.usuarios.findMany({
            where: {
                escuela_id: parseInt(escuela_id),
                roles: { nombre_rol: 'ADMIN' },
                activo: true
            },
            select: {
                id: true, username: true, telefono: true, url_documento: true
            }
        });
        res.json(responsables);
    } catch (error) {
        console.error("Error listando responsables:", error);
        res.status(500).json({ error: "Error interno. ¿Ejecutaste 'npx prisma db push'?" });
    }
});

// 7. GESTIÓN DE TUTORES (CRUD)
app.get('/tutores', async (req, res) => res.json(await prisma.tutores.findMany({ where: { activo: true }, orderBy: { nombres_apellidos: 'asc' } })));

app.post('/admin/tutores-completo', async (req, res) => {
    const { nombres, dni, codigo, correo, especialidad, telefono, rol_id } = req.body;
    try {
        await prisma.$transaction(async (tx) => {
            const user = await tx.usuarios.create({
                data: { username: dni, password_hash: dni, rol_id: parseInt(rol_id), telefono, activo: true }
            });
            await tx.tutores.create({
                data: { nombres_apellidos: nombres, dni, codigo_docente: codigo, correo_institucional: correo, especialidad, usuario_id: user.id, activo: true }
            });
        });
        res.status(201).json({ msg: "Creado" });
    } catch (e) { res.status(500).json({ error: "Error al crear tutor" }); }
});

app.delete('/admin/tutores/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const count = await prisma.estudiantes.count({ where: { tutor_asignado_id: id } });
        if (count > 0) return res.status(400).json({ error: "No se puede eliminar: Tiene estudiantes asignados" });
        
        const tut = await prisma.tutores.findUnique({ where: { id } });
        await prisma.tutores.delete({ where: { id } });
        if (tut?.usuario_id) await prisma.usuarios.delete({ where: { id: tut.usuario_id } });
        
        res.json({ msg: "Eliminado" });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// 8. GESTIÓN DE CICLOS
app.get('/admin/ciclos', async (req, res) => res.json(await prisma.ciclos.findMany({ orderBy: { id: 'desc' } })));
app.post('/admin/ciclos', async (req, res) => {
    try { res.status(201).json(await prisma.ciclos.create({ data: { nombre_ciclo: req.body.nombre_ciclo, activo: true } })); }
    catch (e) { res.status(500).json({ error: "Error" }); }
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
    try {
        const count = await prisma.asignaciones.count({ where: { ciclo_id: parseInt(req.params.id) } });
        if (count > 0) return res.status(400).json({ error: "Tiene alumnos" });
        await prisma.ciclos.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ msg: "Eliminado" });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// 9. ROLES
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
                if (existe) await tx.asignaciones.update({ where: { id: existe.id }, data: { tutor_id: parseInt(tutor_id) } });
                else await tx.asignaciones.create({ data: { estudiante_id: alumno.id, tutor_id: parseInt(tutor_id), ciclo_id: parseInt(ciclo_id) } });
                procesados.push(alumno);
            }
            return procesados;
        });
        res.json({ mensaje: `Procesados ${resultado.length}`, data: resultado });
    } catch (e) { res.status(500).json({ error: "Error masivo" }); }
});

// ==========================================
//          FORMATOS Y REPORTES
// ==========================================

// F01 - Ficha Integral
app.post('/sesiones-tutoria/f01', verifyToken, async (req, res) => {
    const d = req.body;
    try {
        await prisma.$transaction(async (tx) => {
            let datosJSON = { ...d };
            if (typeof d.desarrollo_entrevista === 'string') {
                try { datosJSON = { ...JSON.parse(d.desarrollo_entrevista), ...datosJSON }; } catch (e) { }
            }
            // Actualizar datos contacto estudiante
            await tx.estudiantes.update({
                where: { id: parseInt(d.estudiante_id) },
                data: { telefono: d.telefono, direccion_actual: d.direccion_actual, correo_institucional: d.correo_institucional }
            });

            // Upsert Ficha
            const existente = await tx.sesiones_tutoria.findFirst({ where: { estudiante_id: parseInt(d.estudiante_id), tipo_formato: 'F01' } });
            const dataSesion = {
                tutor_id: parseInt(d.tutor_id), estudiante_id: parseInt(d.estudiante_id), tipo_formato: 'F01', motivo_consulta: 'Ficha Integral',
                fecha: new Date(), firma_tutor_url: d.firma_tutor_url, firma_estudiante_url: d.firma_estudiante_url,
                desarrollo_entrevista: JSON.stringify(datosJSON)
            };

            if (existente) await tx.sesiones_tutoria.update({ where: { id: existente.id }, data: dataSesion });
            else await tx.sesiones_tutoria.create({ data: dataSesion });
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// F02 - Grupales
app.post('/sesiones-grupales', upload.single('evidencia'), async (req, res) => {
    const { tema, fecha, asistentes_ids, tutor_id, total_asignados, total_asistentes, firma_tutor_url } = req.body;
    try {
        const ids = JSON.parse(asistentes_ids || "[]");
        await prisma.$transaction(async (tx) => {
            const sesion = await tx.sesiones_grupales.create({
                data: {
                    tema, fecha: new Date(fecha), tutor_id: parseInt(tutor_id),
                    total_asignados: parseInt(total_asignados), total_asistentes: parseInt(total_asistentes),
                    firma_tutor_url, evidencia_url: req.file ? `/uploads/evidencias/${req.file.filename}` : null
                }
            });
            if (ids.length > 0) {
                await tx.asistencia_grupal.createMany({
                    data: ids.map(eid => ({ estudiante_id: parseInt(eid), sesion_grupal_id: sesion.id, tipo_formato: 'F02' }))
                });
            }
        });
        res.json({ msg: "Creado" });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// F03, F04 y F05
app.post('/sesiones-tutoria/f03', async (req, res) => {
    const { id, estudiante_id, tutor_id, ...data } = req.body;
    try {
        const payload = { ...data, tipo_formato: 'F03', fecha: new Date(), estudiante_id: parseInt(estudiante_id), tutor_id: parseInt(tutor_id) };
        if (id) await prisma.sesiones_tutoria.update({ where: { id: parseInt(id) }, data: payload });
        else await prisma.sesiones_tutoria.create({ data: payload });
        res.json({ msg: "Guardado" });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/sesiones-tutoria/f04', async (req, res) => {
    const { id, estudiante_id, tutor_id, desarrollo_entrevista, ...data } = req.body;
    try {
        const entrevistaStr = typeof desarrollo_entrevista === 'object' ? JSON.stringify(desarrollo_entrevista) : desarrollo_entrevista;
        const payload = { ...data, tipo_formato: 'F04', fecha: new Date(), desarrollo_entrevista: entrevistaStr, estudiante_id: parseInt(estudiante_id), tutor_id: parseInt(tutor_id) };
        
        if (id) await prisma.sesiones_tutoria.update({ where: { id: parseInt(id) }, data: payload });
        else await prisma.sesiones_tutoria.create({ data: payload });
        res.json({ msg: "Guardado" });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/derivaciones', async (req, res) => {
    const d = req.body;
    try {
        await prisma.derivaciones.create({
            data: {
                estudiante_id: parseInt(d.estudiante_id), tutor_id: parseInt(d.tutor_id), tipo_formato: 'F05',
                fecha_solicitud: new Date(), motivo_derivacion: d.motivo_derivacion, area_destino: d.area_destino,
                firma_tutor_url: d.firma_tutor_url
            }
        });
        res.json({ msg: "Derivación creada" });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/sesiones/:id', upload.none(), async (req, res) => {
    const { id } = req.params;
    const { motivo_consulta, desarrollo_entrevista, acuerdos_compromisos, observaciones, resultado } = req.body;
    try {
        const actualizado = await prisma.sesiones_tutoria.update({
            where: { id: parseInt(id) },
            data: { motivo_consulta, desarrollo_entrevista, acuerdos_compromisos, observaciones, resultado }
        });
        res.json({ message: "Actualizada", data: actualizado });
    } catch (error) { res.status(500).json({ error: "No se pudo actualizar" }); }
});
// --- PEGAR EN index.js ANTES DE app.listen ---

// Ruta para listar los informes semestrales enviados por los tutores
app.get('/admin/informes', verifyToken, async (req, res) => {
    try {
        const informes = await prisma.informes_semestrales.findMany({
            include: {
                tutor: {
                    select: { nombres_apellidos: true }
                }
            },
            orderBy: { fecha_envio: 'desc' }
        });
        
        // Mapeamos para facilitar el uso en el frontend
        const data = informes.map(inf => ({
            id: inf.id,
            semestre: inf.semestre,
            docente: inf.tutor?.nombres_apellidos || "Desconocido",
            fecha: inf.fecha_envio,
            estado: inf.estado,
            url_documento: inf.archivo_url,
            estadisticas: {
                total: inf.total_estudiantes,
                riesgo: inf.total_riesgo
            }
        }));

        res.json(data);
    } catch (error) {
        console.error("Error informes:", error);
        res.status(500).json({ error: "Error al cargar informes" });
    }
});

// --- PEGAR EN index.js (Cualquier lugar antes de app.listen) ---

// Ruta para verificar si un tutor específico ya envió su informe
app.get('/tutores/:id/estado-informe', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Buscamos si existe algún informe para este tutor en la BD
        const informe = await prisma.informes_semestrales.findFirst({
            where: { tutor_id: parseInt(id) }
        });

        // Devolvemos true si existe, false si no
        res.json({ enviado: !!informe });
        
    } catch (error) {
        console.error("Error verificando estado informe:", error);
        res.status(500).json({ error: "Error al verificar estado" });
    }
});



// INICIAR SERVIDOR
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});