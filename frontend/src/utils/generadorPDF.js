import { jsPDF } from 'jspdf';

export const generarF04 = (sesion, estudiante, numeroSeguimiento = 1) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yCurrent = 85; // Rastreador de posición vertical

  // --- 1. ENCABEZADO Y LOGO ---
  const logoUrl = '/logo_unajma.png'; 
  try {
    doc.addImage(logoUrl, 'PNG', 15, 8, 22, 22); // Ajustado para que no estorbe
  } catch (e) {
    console.warn("Logo no encontrado");
  }

  doc.setFontSize(10).setFont("helvetica", "bold");
  doc.text("UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS", 42, 15);
  doc.setFontSize(9).setFont("helvetica", "normal");
  doc.text("Dirección de Bienestar Universitario", 42, 20);
  doc.text("Área de Tutoría", 42, 25);
  doc.setFontSize(14).setFont("helvetica", "bold");
  doc.text("ÁREA DE TUTORÍA", pageWidth - 20, 20, { align: 'right' });
  doc.line(15, 32, pageWidth - 15, 32); 

  // --- 2. TÍTULO Y DATOS ---
  doc.setFontSize(12).text("FICHA DE SEGUIMIENTO DE TUTORÍA INDIVIDUAL (formato 04)", pageWidth / 2, 42, { align: 'center' });
  doc.setFontSize(11).setFont("helvetica", "normal");
  doc.text(`Nombre y Apellidos del Tutorado: ${estudiante?.nombres_apellidos || ''}`, 20, 52);
  doc.line(78, 53, pageWidth - 20, 53); 
  doc.text(`Escuela Profesional: ${estudiante?.escuela || 'EPIS'}`, 20, 60);
  doc.line(56, 61, pageWidth - 20, 61); 
  doc.text(`Seguimiento N°: ${numeroSeguimiento || '1'}`, 20, 68);
  doc.line(48, 69, 70, 69);
  doc.text(`Fecha: ${new Date(sesion.fecha).toLocaleDateString()}`, pageWidth - 70, 68);
  doc.line(pageWidth - 58, 69, pageWidth - 20, 69);

  // --- 3. FUNCIÓN DINÁMICA DE TEXTO SOBRE LÍNEAS (Anti-tachado) ---
  const renderSeccionDinamica = (titulo, contenido) => {
    // Verificar si hay espacio para el título
    if (yCurrent > pageHeight - 30) { doc.addPage(); yCurrent = 25; }

    doc.setFont("helvetica", "bold").text(titulo, 20, yCurrent);
    yCurrent += 8;
    doc.setFont("helvetica", "normal");

    const lineasTexto = doc.splitTextToSize(contenido || '', 175);
    const lineHeight = 10;

    lineasTexto.forEach((linea) => {
      // Si llegamos al final de la página, creamos otra
      if (yCurrent > pageHeight - 25) {
        doc.addPage();
        yCurrent = 25;
      }
      
      // Escribir texto 1.5 unidades arriba de la línea
      doc.text(linea, 20, yCurrent - 1.5);
      // Dibujar línea de base
      doc.line(20, yCurrent, pageWidth - 20, yCurrent);
      
      yCurrent += lineHeight;
    });
    yCurrent += 5; // Margen entre secciones
  };

  // Renderizado de las 3 secciones (Sin límite de tamaño)
  renderSeccionDinamica("Aspectos abordados", sesion.motivo_consulta);
  renderSeccionDinamica("Acuerdos", sesion.acuerdos_compromisos);
  renderSeccionDinamica("Observaciones del tutor", sesion.observaciones);

  // --- 4. SECCIÓN DE FIRMAS (Al final de todo el texto) ---
  // Si no hay espacio para las firmas, pasamos a otra hoja
  if (yCurrent > pageHeight - 50) { 
    doc.addPage(); 
    yCurrent = 40; 
  } else { 
    yCurrent += 15; 
  }

  const yFirma = yCurrent + 20;
  // Firma Tutor
  if (sesion.firma_tutor_url) {
    doc.addImage(sesion.firma_tutor_url, 'PNG', 30, yFirma - 22, 45, 18);
  }
  doc.line(25, yFirma, 85, yFirma);
  doc.setFontSize(10).text("Firma del Tutor(a)", 55, yFirma + 5, { align: 'center' });

  // Firma Estudiante
  if (sesion.firma_estudiante_url) {
    doc.addImage(sesion.firma_estudiante_url, 'PNG', 130, yFirma - 22, 45, 18);
  }
  doc.line(125, yFirma, 185, yFirma);
  doc.text("Firma del estudiante tutorado", 155, yFirma + 5, { align: 'center' });

  doc.save(`F04_${estudiante.codigo_estudiante}_Seg${numeroSeguimiento}.pdf`);
};