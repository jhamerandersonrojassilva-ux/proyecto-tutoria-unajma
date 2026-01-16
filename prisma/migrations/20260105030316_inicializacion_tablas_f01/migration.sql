-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "nombre_rol" VARCHAR(50) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol_id" INTEGER,
    "activo" BOOLEAN DEFAULT true,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutores" (
    "id" SERIAL NOT NULL,
    "nombres_apellidos" VARCHAR(255) NOT NULL,
    "dni" VARCHAR(8) NOT NULL,
    "codigo_docente" VARCHAR(20) NOT NULL,
    "correo_institucional" VARCHAR(100),
    "especialidad" VARCHAR(100),
    "activo" BOOLEAN DEFAULT true,
    "usuario_id" INTEGER,

    CONSTRAINT "tutores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudiantes" (
    "id" SERIAL NOT NULL,
    "nombres_apellidos" VARCHAR(255) NOT NULL,
    "fecha_nacimiento" DATE,
    "dni" VARCHAR(8) NOT NULL,
    "codigo_estudiante" VARCHAR(20) NOT NULL,
    "escuela_profesional" VARCHAR(100),
    "ciclo_actual" VARCHAR(10),
    "telefono" VARCHAR(15),
    "correo_institucional" VARCHAR(100),
    "direccion_actual" TEXT,
    "enfermedad_discapacidad" TEXT,
    "intervencion_quirurgica" TEXT,
    "medicamentos" TEXT,
    "trabaja_actualmente" BOOLEAN DEFAULT false,
    "promedio_ponderado" DECIMAL(4,2),
    "tutor_asignado_id" INTEGER,

    CONSTRAINT "estudiantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_grupales" (
    "id" SERIAL NOT NULL,
    "tutor_id" INTEGER NOT NULL,
    "tema" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" VARCHAR(20),
    "hora_cierre" VARCHAR(20),
    "area_tema" VARCHAR(50),
    "total_asignados" INTEGER DEFAULT 0,
    "total_asistentes" INTEGER DEFAULT 0,
    "firma_tutor_url" TEXT,
    "evidencia_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_grupales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistencia_grupal" (
    "id" SERIAL NOT NULL,
    "estudiante_id" INTEGER NOT NULL,
    "sesion_grupal_id" INTEGER NOT NULL,
    "tipo_formato" VARCHAR(10) NOT NULL DEFAULT 'F02',

    CONSTRAINT "asistencia_grupal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_tutoria" (
    "id" SERIAL NOT NULL,
    "estudiante_id" INTEGER,
    "tutor_id" INTEGER,
    "fecha" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "tipo_formato" VARCHAR(20),
    "motivo_consulta" TEXT,
    "desarrollo_entrevista" TEXT,
    "acuerdos_compromisos" TEXT,
    "observaciones" TEXT,
    "firma_estudiante_url" TEXT,
    "firma_tutor_url" TEXT,

    CONSTRAINT "sesiones_tutoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "derivaciones" (
    "id" SERIAL NOT NULL,
    "estudiante_id" INTEGER,
    "tutor_id" INTEGER,
    "fecha_solicitud" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "motivo_derivacion" TEXT,
    "area_destino" VARCHAR(100),
    "estado_tramite" VARCHAR(50) DEFAULT 'Pendiente',
    "oficio_numero" VARCHAR(50),
    "visto_bueno_jefa" BOOLEAN DEFAULT false,
    "fecha_firma_jefa" TIMESTAMP(6),
    "fecha_nacimiento" DATE,
    "edad" INTEGER,
    "semestre" VARCHAR(20),
    "celular" VARCHAR(15),
    "correo_estudiante" VARCHAR(150),
    "escuela_profesional" VARCHAR(100),
    "nombre_tutor_deriva" VARCHAR(255),
    "firma_tutor_url" TEXT,
    "tipo_formato" VARCHAR(10) DEFAULT 'F05',

    CONSTRAINT "derivaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendario_tutorias" (
    "id" SERIAL NOT NULL,
    "estudiante_id" INTEGER,
    "tutor_id" INTEGER,
    "titulo_cita" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "fecha_hora_inicio" TIMESTAMP(6) NOT NULL,
    "fecha_hora_fin" TIMESTAMP(6) NOT NULL,
    "lugar" VARCHAR(100) DEFAULT 'Oficina de Tutoría',
    "estado" VARCHAR(20) DEFAULT 'Programada',
    "enlace_virtual" VARCHAR(255),

    CONSTRAINT "calendario_tutorias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_rol_key" ON "roles"("nombre_rol");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_username_key" ON "usuarios"("username");

-- CreateIndex
CREATE UNIQUE INDEX "tutores_dni_key" ON "tutores"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "tutores_codigo_docente_key" ON "tutores"("codigo_docente");

-- CreateIndex
CREATE UNIQUE INDEX "tutores_usuario_id_key" ON "tutores"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "estudiantes_dni_key" ON "estudiantes"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "estudiantes_codigo_estudiante_key" ON "estudiantes"("codigo_estudiante");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tutores" ADD CONSTRAINT "tutores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudiantes" ADD CONSTRAINT "estudiantes_tutor_asignado_id_fkey" FOREIGN KEY ("tutor_asignado_id") REFERENCES "tutores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sesiones_grupales" ADD CONSTRAINT "sesiones_grupales_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_grupal" ADD CONSTRAINT "asistencia_grupal_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_grupal" ADD CONSTRAINT "asistencia_grupal_sesion_grupal_id_fkey" FOREIGN KEY ("sesion_grupal_id") REFERENCES "sesiones_grupales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_tutoria" ADD CONSTRAINT "sesiones_tutoria_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sesiones_tutoria" ADD CONSTRAINT "sesiones_tutoria_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "derivaciones" ADD CONSTRAINT "derivaciones_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "derivaciones" ADD CONSTRAINT "derivaciones_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calendario_tutorias" ADD CONSTRAINT "calendario_tutorias_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calendario_tutorias" ADD CONSTRAINT "calendario_tutorias_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
