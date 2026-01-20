import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando carga maestra Multiescuela y Blindada...');

  // 1. CREAR ESCUELAS (El contenedor principal)
  const escuelaSistemas = await prisma.escuelas.upsert({
    where: { nombre: 'Ingeniería de Sistemas' },
    update: {},
    create: { nombre: 'Ingeniería de Sistemas' },
  });

  // 2. ROLES ACTUALIZADOS
  const rolSuperAdmin = await prisma.roles.upsert({
    where: { nombre_rol: 'SUPER_ADMIN' },
    update: {},
    create: { nombre_rol: 'SUPER_ADMIN' },
  });

  const rolAdminTutoria = await prisma.roles.upsert({
    where: { nombre_rol: 'ADMIN_TUTORIA' },
    update: {},
    create: { nombre_rol: 'ADMIN_TUTORIA' },
  });

  const rolTutor = await prisma.roles.upsert({
    where: { nombre_rol: 'TUTOR' },
    update: {},
    create: { nombre_rol: 'TUTOR' },
  });

  // 3. CICLO ACADÉMICO (Vinculado a la escuela)
  const cicloActual = await prisma.ciclos.upsert({
    where: { nombre_ciclo: '2025-I' },
    update: { escuela_id: escuelaSistemas.id },
    create: { nombre_ciclo: '2025-I', activo: true, escuela_id: escuelaSistemas.id },
  });

  // 4. USUARIOS DE GESTIÓN (Directora y Responsable)
  // Directora (SUPER_ADMIN)
  await prisma.usuarios.upsert({
    where: { username: 'directora_sistemas' },
    update: { escuela_id: escuelaSistemas.id, super_user: true },
    create: {
      username: 'directora_sistemas',
      password_hash: 'directora123',
      rol_id: rolSuperAdmin.id,
      escuela_id: escuelaSistemas.id,
      super_user: true,
      telefono: '999888777'
    }
  });

  // Responsable de Tutoría (ADMIN_TUTORIA)
  await prisma.usuarios.upsert({
    where: { username: 'responsable_tutoria' },
    update: { escuela_id: escuelaSistemas.id, super_user: false },
    create: {
      username: 'responsable_tutoria',
      password_hash: 'admin123',
      rol_id: rolAdminTutoria.id,
      escuela_id: escuelaSistemas.id,
      super_user: false,
      telefono: '900000000'
    }
  });

  // 5. TUTOR (Juan Pérez - Vinculado a Sistemas)
  const dniTutor = '12345678';
  let tutorUser = await prisma.usuarios.findUnique({ where: { username: 'tutor_unajma' } });

  if (!tutorUser) {
    tutorUser = await prisma.usuarios.create({
      data: {
        username: 'tutor_unajma',
        password_hash: '123456',
        rol_id: rolTutor.id,
        escuela_id: escuelaSistemas.id,
        tutor: {
          create: {
            nombres_apellidos: 'Ing. Juan Pérez',
            dni: dniTutor,
            codigo_docente: 'DOC-001',
            especialidad: 'Ingeniería de Sistemas',
            escuela_id: escuelaSistemas.id // <--- IMPORTANTE
          }
        }
      }
    });
    console.log('✅ Nuevo Tutor Juan Pérez creado.');
  }

  const tutorData = await prisma.tutores.findUnique({ where: { dni: dniTutor } });

  // 6. ESTUDIANTES Y ASIGNACIONES (Vinculados a Sistemas)
  const estudiantesData = [
    { nombres: 'Carlos Quispe', dni: '70605040', cod: '2023-001' },
    { nombres: 'Ana Huamán', dni: '70605041', cod: '2023-002' },
    { nombres: 'Grecia Isabel', dni: '70605044', cod: '2023-005' }
  ];

  for (const est of estudiantesData) {
    const e = await prisma.estudiantes.upsert({
      where: { dni: est.dni },
      update: { 
        tutor_asignado_id: tutorData.id,
        escuela_id: escuelaSistemas.id 
      },
      create: {
        nombres_apellidos: est.nombres,
        dni: est.dni,
        codigo_estudiante: est.cod,
        escuela_profesional: 'Ing. Sistemas',
        escuela_id: escuelaSistemas.id,
        tutor_asignado_id: tutorData.id
      }
    });

    // Asignación histórica
    const asignacionExiste = await prisma.asignaciones.findFirst({
        where: { estudiante_id: e.id, ciclo_id: cicloActual.id }
    });

    if (!asignacionExiste) {
        await prisma.asignaciones.create({
            data: {
                tutor_id: tutorData.id,
                estudiante_id: e.id,
                ciclo_id: cicloActual.id
            }
        });
    }
  }

  console.log('🚀 ¡Seed Multiescuela completado con éxito!');
  console.log('--------------------------------------------------');
  console.log('USUARIOS CREADOS:');
  console.log('1. DIRECTORA: directora_sistemas / directora123');
  console.log('2. RESPONSABLE: responsable_tutoria / admin123');
  console.log('3. TUTOR: tutor_unajma / 123456');
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });