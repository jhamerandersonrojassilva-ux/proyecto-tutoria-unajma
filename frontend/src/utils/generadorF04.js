import { jsPDF } from 'jspdf';

export const generarF04 = (sesion, estudiante, retornarDoc = false, numeroCorrelativo = null) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yCurrent = 85; 

  // --- 0. PREPARACIÓN DE DATOS ---
  let datosExtra = {};
  const raw = sesion.desarrollo_entrevista;

  if (raw) {
    if (typeof raw === 'object') {
       datosExtra = raw;
    } else if (typeof raw === 'string') {
       const limpio = raw.trim();
       if (limpio.startsWith('{') || limpio.startsWith('[')) {
           try { datosExtra = JSON.parse(limpio); } catch (e) { datosExtra = { observaciones: raw }; }
       } else {
           datosExtra = { observaciones: raw }; 
       }
    }
  }

  const datos = { ...sesion, ...datosExtra };

  // --- 1. ENCABEZADO ---
  try { doc.addImage('/logo_unajma.png', 'PNG', 15, 8, 22, 22); } catch (e) {}

  doc.setFontSize(10).setFont("helvetica", "bold");
  doc.text("UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS", 42, 15);
  doc.setFontSize(9).setFont("helvetica", "normal");
  doc.text("Dirección de Bienestar Universitario", 42, 20);
  doc.text("Área de Tutoría", 42, 25);
  doc.setFontSize(14).setFont("helvetica", "bold");
  doc.text("ÁREA DE TUTORÍA", pageWidth - 20, 20, { align: 'right' });
  doc.setLineWidth(0.5);
  doc.line(15, 32, pageWidth - 15, 32); 

  // --- 2. TÍTULO Y DATOS ---
  doc.setFontSize(12).text("FICHA DE SEGUIMIENTO DE TUTORÍA INDIVIDUAL (formato 04)", pageWidth / 2, 42, { align: 'center' });
  doc.setFontSize(11).setFont("helvetica", "normal");
  
  doc.text(`Nombre y Apellidos del Tutorado: ${(estudiante?.nombres_apellidos || '').toUpperCase()}`, 20, 52);
  doc.line(78, 53, pageWidth - 20, 53); 
  
  doc.text(`Escuela Profesional: ${estudiante?.escuela_profesional || 'Ingeniería de Sistemas'}`, 20, 60);
  doc.line(56, 61, pageWidth - 20, 61); 
  
  // --- LÓGICA DEL NÚMERO ---
  // Si numeroCorrelativo existe (ZIP), úsalo.
  // Si no, busca en los datos guardados.
  // Si no hay nada, pon "1".
  let numFinal = "1"; 
  if (numeroCorrelativo) {
      numFinal = numeroCorrelativo;
  } else if (datos.numero_seguimiento && datos.numero_seguimiento !== "") {
      numFinal = datos.numero_seguimiento;
  }

  doc.text(`Seguimiento N°: ${numFinal}`, 20, 68);
  doc.line(48, 69, 70, 69);
  
  let fechaTexto = "---";
  if (datos.fecha) {
      try { fechaTexto = new Date(datos.fecha).toLocaleDateString('es-ES', { timeZone: 'UTC' }); } catch(e) { fechaTexto = String(datos.fecha).split('T')[0]; }
  }
  doc.text(`Fecha: ${fechaTexto}`, pageWidth - 70, 68);
  doc.line(pageWidth - 58, 69, pageWidth - 20, 69);

  // --- 3. CONTENIDO ---
  const renderSeccionDinamica = (titulo, contenido) => {
    if (yCurrent > pageHeight - 30) { doc.addPage(); yCurrent = 25; }
    doc.setFont("helvetica", "bold").text(titulo, 20, yCurrent);
    yCurrent += 8;
    doc.setFont("helvetica", "normal");
    
    const textoSeguro = typeof contenido === 'string' ? contenido : JSON.stringify(contenido || "");
    const lineasTexto = doc.splitTextToSize(textoSeguro || '', pageWidth - 40);
    const lineasFinales = lineasTexto.length > 0 ? lineasTexto : ["", ""];

    lineasFinales.forEach((linea) => {
      if (yCurrent > pageHeight - 25) { doc.addPage(); yCurrent = 25; }
      doc.text(linea, 20, yCurrent - 1.5);
      doc.setLineWidth(0.1);
      doc.line(20, yCurrent, pageWidth - 20, yCurrent);
      yCurrent += 10;
    });
    yCurrent += 5; 
  };

  renderSeccionDinamica("Aspectos abordados", datos.motivo_consulta || datos.aspectos_abordados);
  renderSeccionDinamica("Acuerdos", datos.acuerdos_compromisos || datos.acuerdos);
  renderSeccionDinamica("Observaciones del tutor", datos.observaciones);

  // --- 4. FIRMAS ---
  if (yCurrent > pageHeight - 50) { doc.addPage(); yCurrent = 40; } else { yCurrent += 15; }
  const yFirma = yCurrent + 20;
  
  if (datos.firma_tutor_url) {
    try { doc.addImage(datos.firma_tutor_url, 'PNG', 30, yFirma - 22, 45, 18); } catch(e){}
  }
  doc.setLineWidth(0.5);
  doc.line(25, yFirma, 85, yFirma);
  doc.setFontSize(10).text("Firma del Tutor(a)", 55, yFirma + 5, { align: 'center' });

  if (datos.firma_estudiante_url) {
    try { doc.addImage(datos.firma_estudiante_url, 'PNG', 130, yFirma - 22, 45, 18); } catch(e){}
  }
  doc.line(125, yFirma, 185, yFirma);
  doc.text("Firma del estudiante tutorado", 155, yFirma + 5, { align: 'center' });

  if (retornarDoc) {
      return doc; 
  } else {
      const fName = datos.fecha ? new Date(datos.fecha).toISOString().split('T')[0] : 'fecha';
      doc.save(`F04_SEGUIMIENTO_${estudiante.codigo_estudiante}_${fName}.pdf`);
  }
};