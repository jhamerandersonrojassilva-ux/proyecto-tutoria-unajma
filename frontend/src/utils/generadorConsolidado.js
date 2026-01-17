import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generarPDFConsolidado = (data, nombreCiclo) => {
  const doc = new jsPDF();
  const fechaImpresion = new Date().toLocaleDateString();

  // --- 1. CABECERA INSTITUCIONAL ---
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // Azul oscuro
  doc.setFont("helvetica", "bold");
  doc.text("UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS", 105, 20, { align: "center" });
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("OFICINA DE TUTORÍA Y APOYO PEDAGÓGICO", 105, 28, { align: "center" });
  
  doc.setLineWidth(0.5);
  doc.line(20, 32, 190, 32);

  // --- 2. DATOS DEL REPORTE ---
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("EXPEDIENTE DE CUMPLIMIENTO DE TUTORÍA", 105, 45, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  // Tabla invisible para alinear datos del docente
  autoTable(doc, {
    startY: 50,
    body: [
      ['Docente Tutor:', data.nombre || '---'],
      ['Programa de Estudios:', data.programa || 'Ingeniería de Sistemas'],
      ['Semestre Académico:', nombreCiclo || '2025-I'],
      ['Fecha de Emisión:', fechaImpresion],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
  });

  // --- 3. RESUMEN CUANTITATIVO (Lo que tenías, pero corregido) ---
  const resumen = data.resumen_legajo || [];
  const getCant = (t) => resumen.find(r => r.tipo === t)?.cantidad || 0;

  doc.text("I. RESUMEN DE LEGAJO DOCUMENTAL", 14, doc.lastAutoTable.finalY + 10);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 15,
    head: [['Código', 'Instrumento de Gestión', 'Cantidad', 'Estado']],
    body: [
      ['F01', 'Ficha Integral del Estudiante', getCant('F01'), getCant('F01') > 0 ? 'Conforme' : 'Pendiente'],
      ['F02', 'Informe de Tutoría Grupal', getCant('F02'), 'Registrado'],
      ['F03', 'Ficha de Entrevista Individual', getCant('F03'), 'Registrado'],
      ['F04', 'Registro de Sesiones (Seguimiento)', getCant('F04'), 'Registrado'],
      ['F05', 'Derivación a Servicios Especializados', getCant('F05'), getCant('F05') > 0 ? 'Atención Prioritaria' : 'Sin Incidencias'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    styles: { fontSize: 9 },
  });

  // --- 4. LISTA DE ESTUDIANTES ASIGNADOS (NUEVO - VITAL PARA EL ADMIN) ---
  const estudiantes = data.lista_estudiantes || [];
  
  // Controlamos salto de página si la lista es larga
  let startYEstudiantes = doc.lastAutoTable.finalY + 15;
  if (startYEstudiantes > 250) {
      doc.addPage();
      startYEstudiantes = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.text(`II. ESTUDIANTES A CARGO (${estudiantes.length})`, 14, startYEstudiantes);

  if (estudiantes.length > 0) {
      const filasEstudiantes = estudiantes.map((est, index) => [
          index + 1,
          est.codigo_estudiante,
          est.nombres_apellidos,
          'Asignado'
      ]);

      autoTable(doc, {
        startY: startYEstudiantes + 5,
        head: [['N°', 'Código', 'Apellidos y Nombres', 'Condición']],
        body: filasEstudiantes,
        theme: 'striped',
        headStyles: { fillColor: [71, 85, 105] }, // Color gris azulado
        styles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 30 } }
      });
  } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text("No tiene estudiantes asignados en el sistema.", 14, startYEstudiantes + 10);
  }

  // --- 5. CONCLUSIONES DEL DOCENTE ---
  let finalY = doc.lastAutoTable.finalY + 15;
  
  // Verificar espacio para evitar cortar el cuadro
  if (finalY > 230) { doc.addPage(); finalY = 20; }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("III. OBSERVACIONES Y CONCLUSIONES DEL TUTOR", 14, finalY);

  doc.setDrawColor(200);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, finalY + 5, 182, 30, 'FD'); // Cuadro gris claro
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const textoObservacion = data.observaciones_informe || "Ninguna observación registrada.";
  const lineasObs = doc.splitTextToSize(textoObservacion, 175);
  doc.text(lineasObs, 18, finalY + 12);

  // ==========================================
  // --- 6. SECCIÓN DE FIRMAS (AJUSTADA) ---
  // ==========================================
  
  // AQUÍ ESTÁ EL CAMBIO: Aumentamos a +90 para bajarlas más
  const firmaY = finalY + 60; 
  
  // Validamos si se sale de la hoja (A4)
  const limiteHoja = 280;
  let yFirmas = firmaY;

  if (firmaY > limiteHoja) { 
      doc.addPage(); 
      yFirmas = 60; // Si salta de página, las ponemos arriba pero con margen
  }

  // --- FIRMA DEL TUTOR (IZQUIERDA) ---
  doc.setLineWidth(0.5);
  doc.setDrawColor(0); // Negro para la línea
  doc.line(30, yFirmas, 90, yFirmas); // Línea
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DOCENTE TUTOR", 60, yFirmas + 5, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  // Imprimimos el nombre del tutor
  const nombreTutor = (data.nombre || 'Docente').toUpperCase();
  doc.text(nombreTutor, 60, yFirmas + 10, { align: "center" });

  // --- FIRMA DEL RESPONSABLE (DERECHA) ---
  doc.line(120, yFirmas, 180, yFirmas); // Línea
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("RESPONSABLE DE TUTORÍA", 150, yFirmas + 5, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Visto Bueno (Vo.Bo.)", 150, yFirmas + 10, { align: "center" });

  // --- DESCARGAR ---
  doc.save(`Expediente_${data.nombre?.replace(/\s+/g, '_') || 'Tutor'}.pdf`);
};