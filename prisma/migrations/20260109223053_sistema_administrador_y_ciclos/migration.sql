-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "telefono" VARCHAR(15);

-- CreateTable
CREATE TABLE "ciclos" (
    "id" SERIAL NOT NULL,
    "nombre_ciclo" VARCHAR(20) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ciclos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones" (
    "id" SERIAL NOT NULL,
    "tutor_id" INTEGER NOT NULL,
    "estudiante_id" INTEGER NOT NULL,
    "ciclo_id" INTEGER NOT NULL,
    "fecha_asigna" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notificado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "asignaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ciclos_nombre_ciclo_key" ON "ciclos"("nombre_ciclo");

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
