-- DropForeignKey
ALTER TABLE "sesiones_tutoria" DROP CONSTRAINT "sesiones_tutoria_estudiante_id_fkey";

-- DropForeignKey
ALTER TABLE "sesiones_tutoria" DROP CONSTRAINT "sesiones_tutoria_tutor_id_fkey";

-- AlterTable
ALTER TABLE "sesiones_tutoria" ADD COLUMN     "afecta_desempeño" TEXT,
ADD COLUMN     "asignaturas_desaprobadas" TEXT,
ADD COLUMN     "año_ingreso" VARCHAR(10),
ADD COLUMN     "cargo_trabajo" TEXT,
ADD COLUMN     "competencias_carrera" TEXT,
ADD COLUMN     "concentra" VARCHAR(10),
ADD COLUMN     "conflictos_familia" VARCHAR(10),
ADD COLUMN     "conflictos_porque" TEXT,
ADD COLUMN     "dif_docente" TEXT,
ADD COLUMN     "dif_trabajos" TEXT,
ADD COLUMN     "dificultades_estudio" TEXT,
ADD COLUMN     "estado_civil" VARCHAR(20),
ADD COLUMN     "expectativas_escuela" TEXT,
ADD COLUMN     "familiares" JSONB,
ADD COLUMN     "horario_trabajo" TEXT,
ADD COLUMN     "identificado_escuela" TEXT,
ADD COLUMN     "lugar_nacimiento" TEXT,
ADD COLUMN     "lugar_trabajo" TEXT,
ADD COLUMN     "mejoras_escuela" TEXT,
ADD COLUMN     "mencion_tecnicas" TEXT,
ADD COLUMN     "metodos_aprendizaje" TEXT,
ADD COLUMN     "porque_satisfecho" TEXT,
ADD COLUMN     "promedio_mayor_14" VARCHAR(10),
ADD COLUMN     "reaccion_problema" TEXT,
ADD COLUMN     "recurre_a" TEXT,
ADD COLUMN     "referencia_emergencia" TEXT,
ADD COLUMN     "relacion_familia" VARCHAR(20),
ADD COLUMN     "relacion_porque" TEXT,
ADD COLUMN     "rend_auto" VARCHAR(50),
ADD COLUMN     "rend_semestre_ant" TEXT,
ADD COLUMN     "salud_cirugia" VARCHAR(10),
ADD COLUMN     "salud_cirugia_cual" TEXT,
ADD COLUMN     "salud_enfermedad" VARCHAR(10),
ADD COLUMN     "salud_enfermedad_cual" TEXT,
ADD COLUMN     "salud_medicamentos" VARCHAR(10),
ADD COLUMN     "salud_medicamentos_cuales" TEXT,
ADD COLUMN     "satisfecho_carrera" VARCHAR(10),
ADD COLUMN     "siente_consigo" VARCHAR(20),
ADD COLUMN     "siente_porque" TEXT,
ADD COLUMN     "tecnicas_estudio" VARCHAR(10),
ADD COLUMN     "tel_emergencia" VARCHAR(50),
ADD COLUMN     "tiempo_libre" TEXT,
ADD COLUMN     "trabaja_actualmente" VARCHAR(10);

-- AddForeignKey
ALTER TABLE "sesiones_tutoria" ADD CONSTRAINT "sesiones_tutoria_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_tutoria" ADD CONSTRAINT "sesiones_tutoria_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
