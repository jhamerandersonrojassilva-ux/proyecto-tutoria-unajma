import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando carga maestra blindada...');

  // 1. ROLES
  const rolAdmin = await prisma.roles.upsert({
    where: { nombre_rol: 'ADMIN' },
    update: {},
    create: { nombre_rol: 'ADMIN' },
  });

  const rolTutor = await prisma.roles.upsert({
    where: { nombre_rol: 'TUTOR' },
    update: {},
    create: { nombre_rol: 'TUTOR' },
  });

  // 2. CICLO
  const cicloActual = await prisma.ciclos.upsert({
    where: { nombre_ciclo: '2025-I' },
    update: {},
    create: { nombre_ciclo: '2025-I', activo: true },
  });

  // 3. ADMINISTRADOR
  await prisma.usuarios.upsert({
    where: { username: 'admin_unajma' },
    update: { rol_id: rolAdmin.id },
    create: {
      username: 'admin_unajma',
      password_hash: 'admin123', 
      rol_id: rolAdmin.id,
      telefono: '900000000'
    }
  });
  console.log('✅ Admin verificado.');

  // 4. TUTOR (CORRECCIÓN DEL ERROR DE DNI)
  // Primero buscamos si el tutor ya existe por DNI para evitar el error P2002
  const dniTutor = '12345678';
  let tutorExistente = await prisma.tutores.findUnique({ where: { dni: dniTutor } });

  if (!tutorExistente) {
    await prisma.usuarios.create({
      data: {
        username: 'tutor_unajma',
        password_hash: '123456',
        rol_id: rolTutor.id,
        telefono: '987654321',
        tutor: {
          create: {
            nombres_apellidos: 'Ing. Juan Pérez',
            dni: dniTutor,
            codigo_docente: 'DOC-001',
            especialidad: 'Ingeniería de Sistemas'
          }
        }
      }
    });
    console.log('✅ Nuevo Tutor creado.');
  } else {
    console.log('✅ El Tutor ya existía, saltando creación.');
  }

  // 5. ESTUDIANTES Y ASIGNACIONES
  const estudiantesData = [
    { nombres: 'Carlos Quispe', dni: '70605040', cod: '2023-001' },
    { nombres: 'Ana Huamán', dni: '70605041', cod: '2023-002' },
    { nombres: 'Grecia Isabel', dni: '70605044', cod: '2023-005' }
  ];

  const tutorFinal = await prisma.tutores.findUnique({ where: { dni: dniTutor } });

  for (const est of estudiantesData) {
    const e = await prisma.estudiantes.upsert({
      where: { dni: est.dni },
      update: { tutor_asignado_id: tutorFinal.id },
      create: {
        nombres_apellidos: est.nombres,
        dni: est.dni,
        codigo_estudiante: est.cod,
        escuela_profesional: 'Ing. Sistemas',
        tutor_asignado_id: tutorFinal.id
      }
    });

    // Creamos la asignación histórica si no existe
    const asignacionExiste = await prisma.asignaciones.findFirst({
        where: { estudiante_id: e.id, ciclo_id: cicloActual.id }
    });

    if (!asignacionExiste) {
        await prisma.asignaciones.create({
            data: {
                tutor_id: tutorFinal.id,
                estudiante_id: e.id,
                ciclo_id: cicloActual.id
            }
        });
    }
  }

  console.log('🚀 ¡Seed completado con éxito!');
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });