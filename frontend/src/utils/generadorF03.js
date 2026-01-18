import { jsPDF } from "jspdf";

export const generarF03 = (sesion, estudiante, retornarDoc = false) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  
  // Empezamos un poco más arriba para ganar espacio
  let y = 15; 

  // --- 1. ENCABEZADO OFICIAL ---
  const dibujarEncabezado = () => {
    // Logo
    try {
      doc.addImage('/logo_unajma.png', 'PNG', 15, 10, 18, 18); 
    } catch (e) { console.warn("Logo no encontrado"); }

    // Texto Institucional
    doc.setTextColor(0, 0, 0); 
    doc.setFontSize(8).setFont("helvetica", "bold");
    doc.text("UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS", 38, 16);
    
    doc.setFontSize(7).setFont("helvetica", "normal");
    doc.text("Dirección de Bienestar Universitario", 38, 20);
    doc.text("Área de Tutoría", 38, 24);

    // Título Lateral
    doc.setTextColor(100, 100, 100); 
    doc.setFontSize(10).setFont("helvetica", "bold");
    doc.text("ÁREA DE TUTORÍA", pageWidth - margin, 18, { align: "right" });

    // Línea separadora
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(15, 30, pageWidth - 15, 30);

    // Reset
    doc.setTextColor(0, 0, 0);
  };

  // --- 2. CONTROL DE ESPACIO ---
  const verificarEspacio = (alturaRequerida) => {
    // Si no cabe, salta de página y reinicia Y
    if (y + alturaRequerida > pageHeight - margin) {
      doc.addPage();
      dibujarEncabezado();
      y = 40; // Margen superior seguro en nueva página
    }
  };

  // --- INICIO ---
  dibujarEncabezado();

  y = 40; // Subimos un poco el título principal
  doc.setFontSize(11).setFont("helvetica", "bold");
  doc.text("FICHA DE ENTREVISTA DE TUTORÍA INDIVIDUAL (Formato 03)", pageWidth / 2, y, { align: "center" });

  y += 12;
  // --- DATOS GENERALES ---
  doc.setFontSize(9); // Fuente ligeramente más pequeña para compactar

  const dibujarCampo = (etiqueta, valor) => {
    doc.setFont("helvetica", "bold");
    doc.text(etiqueta, margin, y);
    
    const anchoEtiqueta = doc.getTextWidth(etiqueta) + 2;
    doc.setFont("helvetica", "normal");
    doc.text((valor || "").toUpperCase(), margin + anchoEtiqueta, y);
    
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.line(margin + anchoEtiqueta, y + 1, pageWidth - margin, y + 1);
    
    y += 8; // Reducido de 10 a 8 para ganar espacio
  };

  dibujarCampo("Nombre y Apellidos del Tutorado:", estudiante.nombres_apellidos);
  dibujarCampo("Escuela profesional:", estudiante.escuela_profesional);

  // Fecha
  doc.setFont("helvetica", "bold");
  doc.text("Fecha de entrevista:", margin, y);
  const anchoFecha = doc.getTextWidth("Fecha de entrevista:") + 2;
  const fechaFmt = datos.fecha ? new Date(datos.fecha).toLocaleDateString('es-ES') : "";
  
  doc.setFont("helvetica", "normal");
  doc.text(fechaFmt, margin + anchoFecha, y);
  doc.line(margin + anchoFecha, y + 1, margin + anchoFecha + 30, y + 1);
  
  y += 12;

  // --- BLOQUES RAYADOS (Compactos) ---
  const dibujarSeccionRayada = (titulo, contenido) => {
    verificarEspacio(20); 
    
    // Título
    doc.setFont("helvetica", "bold");
    doc.text(titulo, margin, y);
    y += 6; // Espacio entre título y texto reducido

    doc.setFont("helvetica", "normal");
    
    // Dividir texto
    const lineasTexto = doc.splitTextToSize(contenido || "", contentWidth);
    
    // Aseguramos al menos 2 líneas para estética, pero no exageramos si hay poco texto
    const cantidadLineas = Math.max(lineasTexto.length + 1, 2);

    for (let i = 0; i < cantidadLineas; i++) {
      verificarEspacio(7); // Verificar cada renglón (7 puntos)
      
      // Texto
      if (lineasTexto[i]) {
        doc.text(lineasTexto[i], margin, y - 1);
      }
      
      // Línea
      doc.setDrawColor(150); // Gris suave para las líneas
      doc.setLineWidth(0.1);
      doc.line(margin, y, pageWidth - margin, y); 
      
      y += 7; // Altura de renglón reducida para compactar (antes 8)
    }
    y += 4; // Separador entre secciones reducido
  };

  dibujarSeccionRayada("Motivo de la entrevista:", datos.motivo_consulta);
  dibujarSeccionRayada("Desarrollo de la entrevista:", datos.desarrollo_entrevista);
  dibujarSeccionRayada("Recomendaciones y Acuerdos:", datos.acuerdos_compromisos);
  // --- PIE DE PÁGINA ---
  verificarEspacio(35); // Verificar espacio para checkboxes

  let area = datos.area_entrevista || "";
  let proxCita = datos.proxima_cita || "";
  
  // Intentar parsear JSON si viene empaquetado
  if (!area && datos.observaciones && datos.observaciones.startsWith('{')) {
      try { const j = JSON.parse(datos.observaciones); area = j.area; proxCita = j.proxima_cita; } catch(e){}
  }

  // Área
  doc.setFont("helvetica", "bold");
  doc.text("La entrevista corresponde al área:", margin, y);
  y += 7;
  
  doc.setFont("helvetica", "normal");
  const gap = contentWidth / 3;
  
  // Opciones
  doc.text(`Académica ( ${area === 'Académica' ? 'X' : '  '} )`, margin + 10, y);
  doc.text(`Personal ( ${area === 'Personal' ? 'X' : '  '} )`, margin + gap, y);
  doc.text(`Profesional ( ${area === 'Profesional' ? 'X' : '  '} )`, margin + (gap * 2), y);

  y += 10;

  // Próxima Cita
  doc.setFont("helvetica", "bold");
  doc.text("Próxima cita (seguimiento):", margin, y);
  const wCita = doc.getTextWidth("Próxima cita (seguimiento):") + 2;
  doc.setFont("helvetica", "normal");
  doc.text(proxCita || "", margin + wCita, y);
  doc.setDrawColor(0);
  doc.line(margin + wCita, y + 1, pageWidth - margin, y + 1);

  // --- FIRMAS INTELIGENTES ---
  
  const alturaFirmas = 45; // Altura necesaria para el bloque de firmas
  const espacioRestante = pageHeight - margin - y;

  // Si hay suficiente espacio en la hoja actual (> 50px), las ponemos ahí.
  // Si no, forzamos nueva hoja.
  if (espacioRestante < alturaFirmas) {
      doc.addPage();
      dibujarEncabezado();
      y = 50; // Margen superior en nueva hoja
  } else {
      // Si sobra MUCHÍSIMO espacio (ej. media hoja), las empujamos un poco abajo
      // para que se vea estético, pero sin pasarnos de hoja.
      if (espacioRestante > 100) {
          y += 20; 
      } else {
          y += 15; // Espacio estándar si estamos ajustados
      }
  }

  const firmaY = y + 25; // Posición de la línea de firma
  const anchoFirma = 70;
  const xTutor = margin + 10;
  const xEst = pageWidth - margin - anchoFirma - 10;

  // 1. IMÁGENES (Se dibujan sobre la línea)
  if (datos.firma_tutor_url) {
    try { 
      doc.addImage(datos.firma_tutor_url, 'PNG', xTutor + 5, firmaY - 22, 60, 20); 
    } catch(e){}
  }

  if (datos.firma_estudiante_url) {
    try { 
      doc.addImage(datos.firma_estudiante_url, 'PNG', xEst + 5, firmaY - 22, 60, 20); 
    } catch(e){}
  }

  // 2. LÍNEAS Y TEXTO
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.setFontSize(8); // Fuente pequeña para firmas
  
  // Tutor
  doc.line(xTutor, firmaY, xTutor + anchoFirma, firmaY);
  doc.setFont("helvetica", "bold");
  doc.text("Firma del Tutor(a)", xTutor + (anchoFirma/2), firmaY + 5, { align: "center" });

  // Estudiante
  doc.line(xEst, firmaY, xEst + anchoFirma, firmaY);
  doc.text("Firma del estudiante tutorado", xEst + (anchoFirma/2), firmaY + 5, { align: "center" });

  // Guardar
  const nombreLimpio = (estudiante.nombres_apellidos || "Estudiante").replace(/[^a-zA-Z0-9]/g, '_');
  if (retornarDoc) {
      return doc;
  } else {
      doc.save(`F03_ENTREVISTA_${estudiante.codigo_estudiante}.pdf`);
  }
};