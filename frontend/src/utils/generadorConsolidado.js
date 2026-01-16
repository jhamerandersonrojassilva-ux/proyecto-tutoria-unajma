import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generarPDFConsolidado = (data, ciclo) => {
    const doc = new jsPDF();
    const { tutor, resumen } = data;

    // Encabezado Institucional
    doc.setFontSize(10);
    doc.text("UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS", 105, 15, { align: 'center' });
    doc.text("ESCUELA PROFESIONAL DE INGENIERÍA DE SISTEMAS", 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE CONSOLIDADO DE TUTORÍA INTEGRAL", 105, 30, { align: 'center' });

    // Datos Informativos
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`CICLO ACADÉMICO: ${ciclo}`, 20, 45);
    doc.text(`TUTOR: ${tutor.nombres_apellidos}`, 20, 52);
    doc.text(`DNI: ${tutor.dni}`, 20, 59);

    // Tabla 1: Resumen de Fichas
    doc.autoTable({
        startY: 65,
        head: [['Formato', 'Descripción', 'Cantidad']],
        body: [
            ['F01', 'Ficha de Tutoría Integral', resumen.F01],
            ['F02', 'Informe de Tutoría Grupal', resumen.F02],
            ['F03', 'Ficha de Entrevista', resumen.F03],
            ['F04', 'Ficha de Seguimiento', resumen.F04],
            ['F05', 'Ficha de Derivación', resumen.F05],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] }
    });

    // Tabla 2: Lista de Estudiantes
    doc.text("RELACIÓN DE ESTUDIANTES ATENDIDOS:", 20, doc.lastAutoTable.finalY + 15);
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 20,
        head: [['#', 'Código', 'Nombres y Apellidos', 'DNI']],
        body: tutor.estudiantes.map((est, index) => [
            index + 1, est.codigo_estudiante, est.nombres_apellidos, est.dni
        ]),
        theme: 'striped'
    });

    // Firmas
    const finalY = doc.lastAutoTable.finalY + 40;
    doc.line(40, finalY, 90, finalY);
    doc.text("Firma del Docente Tutor", 45, finalY + 5);
    doc.line(120, finalY, 170, finalY);
    doc.text("Dirección de Tutoría", 125, finalY + 5);

    doc.save(`Consolidado_${tutor.nombres_apellidos}_${ciclo}.pdf`);
};