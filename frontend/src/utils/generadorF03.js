import { jsPDF } from "jspdf";

export const generarF03 = (sesion, estudiante, retornarDoc = false) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  
  // --- 0. PREPARACIÓN DE DATOS (BLINDADA CONTRA ERRORES) ---
  let infoExtra = {};
  const raw = sesion.desarrollo_entrevista;

  if (raw) {
    if (typeof raw === 'object') {
        // Caso 1: Ya es un objeto (ideal)
        infoExtra = raw;
    } else if (typeof raw === 'string') {
        // Caso 2: Es un string. Verificamos si parece JSON antes de intentar parsear.
        const textoLimpio = raw.trim();
        if (textoLimpio.startsWith('{') || textoLimpio.startsWith('[')) {
            try {
                infoExtra = JSON.parse(textoLimpio);
            } catch (e) {
                // Si falla el parseo (JSON corrupto), lo tratamos como texto plano
                console.warn("JSON corrupto, usando como texto plano.");
                infoExtra = { desarrollo: raw }; // Asignamos el texto al campo desarrollo
            }
        } else {
            // Caso 3: Es texto plano (ej: "ASDASD"). No intentamos parsear.
            infoExtra = { desarrollo: raw };
        }
    }
  }

  // Fusionamos: lo que venga en 'infoExtra' tiene prioridad sobre 'sesion', 
  // excepto si sesion tiene datos más frescos.
  const datos = { ...sesion, ...infoExtra };

  // Definimos las variables finales para imprimir, con fallbacks
  const motivoTexto = datos.motivo_consulta || "---";
  
  // Lógica inteligente para el desarrollo:
  // 1. Busca en el JSON parseado (desarrollo_entrevista_texto o desarrollo)
  // 2. Si no, busca en observaciones
  // 3. Si no, usa el raw (por si acaso)
  const desarrolloTexto = infoExtra.desarrollo_entrevista_texto || infoExtra.desarrollo || datos.observaciones || (typeof raw === 'string' ? raw : "---");
  
  const acuerdosTexto = datos.acuerdos_compromisos || datos.acuerdos || "---";

  // --- 1. ENCABEZADO ---
  let y = 15; 
  const dibujarEncabezado = () => {
    try {
      doc.addImage('/logo_unajma.png', 'PNG', 15, 10, 18, 18); 
    } catch (e) { /* Sin logo */ }

    doc.setTextColor(0, 0, 0); 
    doc.setFontSize(8).setFont("helvetica", "bold");
    doc.text("UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS", 38, 16);
    doc.setFontSize(7).setFont("helvetica", "normal");
    doc.text("Dirección de Bienestar Universitario", 38, 20);
    doc.text("Área de Tutoría", 38, 24);

    doc.setTextColor(100, 100, 100); 
    doc.setFontSize(10).setFont("helvetica", "bold");
    doc.text("ÁREA DE TUTORÍA", pageWidth - margin, 18, { align: "right" });

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(15, 30, pageWidth - 15, 30);
    doc.setTextColor(0, 0, 0);
  };

  const verificarEspacio = (alturaRequerida) => {
    if (y + alturaRequerida > pageHeight - margin) {
      doc.addPage();
      dibujarEncabezado();
      y = 40;
    }
  };

  // --- INICIO DOCUMENTO ---
  dibujarEncabezado();

  y = 40; 
  doc.setFontSize(11).setFont("helvetica", "bold");
  doc.text("FICHA DE ENTREVISTA DE TUTORÍA INDIVIDUAL (Formato 03)", pageWidth / 2, y, { align: "center" });

  y += 12;
  
  // --- DATOS GENERALES ---
  doc.setFontSize(9);

  const dibujarCampo = (etiqueta, valor) => {
    doc.setFont("helvetica", "bold");
    doc.text(etiqueta, margin, y);
    const anchoEtiqueta = doc.getTextWidth(etiqueta) + 2;
    doc.setFont("helvetica", "normal");
    doc.text((valor || "").toUpperCase(), margin + anchoEtiqueta, y);
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.line(margin + anchoEtiqueta, y + 1, pageWidth - margin, y + 1);
    y += 8;
  };

  dibujarCampo("Nombre y Apellidos del Tutorado:", estudiante.nombres_apellidos);
  dibujarCampo("Escuela profesional:", estudiante.escuela_profesional);

  // Fecha
  doc.setFont("helvetica", "bold");
  doc.text("Fecha de entrevista:", margin, y);
  const anchoFecha = doc.getTextWidth("Fecha de entrevista:") + 2;
  
  let fechaFmt = "";
  if (datos.fecha) {
      try {
        fechaFmt = new Date(datos.fecha).toLocaleDateString('es-ES', { timeZone: 'UTC' });
        if(fechaFmt === "Invalid Date") throw new Error();
      } catch(e) { fechaFmt = String(datos.fecha).split('T')[0]; }
  }
  
  doc.setFont("helvetica", "normal");
  doc.text(fechaFmt, margin + anchoFecha, y);
  doc.line(margin + anchoFecha, y + 1, margin + anchoFecha + 30, y + 1);
  
  y += 12;

  // --- SECCIONES DE TEXTO (USANDO LAS VARIABLES LIMPIAS) ---
  const dibujarSeccionRayada = (titulo, contenido) => {
    verificarEspacio(20); 
    doc.setFont("helvetica", "bold");
    doc.text(titulo, margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    // Aseguramos que contenido sea string para evitar crash en splitTextToSize
    const textoSeguro = typeof contenido === 'string' ? contenido : JSON.stringify(contenido || "");
    const lineasTexto = doc.splitTextToSize(textoSeguro, contentWidth);
    
    const cantidadLineas = Math.max(lineasTexto.length + 1, 2);

    for (let i = 0; i < cantidadLineas; i++) {
      verificarEspacio(7);
      if (lineasTexto[i]) doc.text(lineasTexto[i], margin, y - 1);
      doc.setDrawColor(150);
      doc.setLineWidth(0.1);
      doc.line(margin, y, pageWidth - margin, y); 
      y += 7;
    }
    y += 4;
  };

  // AQUÍ ESTÁ EL CAMBIO CLAVE: Usamos las variables procesadas arriba
  dibujarSeccionRayada("Motivo de la entrevista:", motivoTexto);
  dibujarSeccionRayada("Desarrollo de la entrevista:", desarrolloTexto);
  dibujarSeccionRayada("Recomendaciones y Acuerdos:", acuerdosTexto);

  // --- PIE DE PÁGINA ---
  verificarEspacio(35);

  let area = datos.area_entrevista || datos.area || "";
  let proxCita = datos.proxima_cita || "";
  
  // Intento final de recuperar area si está en un JSON mal formado en observaciones
  if (!area && datos.observaciones && typeof datos.observaciones === 'string' && datos.observaciones.includes('{')) {
      try { const j = JSON.parse(datos.observaciones); area = j.area; proxCita = j.proxima_cita; } catch(e){}
  }

  doc.setFont("helvetica", "bold");
  doc.text("La entrevista corresponde al área:", margin, y);
  y += 7;
  
  doc.setFont("helvetica", "normal");
  const gap = contentWidth / 3;
  
  doc.text(`Académica ( ${area === 'Académica' ? 'X' : '  '} )`, margin + 10, y);
  doc.text(`Personal ( ${area === 'Personal' ? 'X' : '  '} )`, margin + gap, y);
  doc.text(`Profesional ( ${area === 'Profesional' ? 'X' : '  '} )`, margin + (gap * 2), y);

  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("Próxima cita (seguimiento):", margin, y);
  const wCita = doc.getTextWidth("Próxima cita (seguimiento):") + 2;
  doc.setFont("helvetica", "normal");
  doc.text(proxCita || "", margin + wCita, y);
  doc.setDrawColor(0);
  doc.line(margin + wCita, y + 1, pageWidth - margin, y + 1);

  // --- FIRMAS ---
  const alturaFirmas = 45;
  const espacioRestante = pageHeight - margin - y;

  if (espacioRestante < alturaFirmas) {
      doc.addPage();
      dibujarEncabezado();
      y = 50; 
  } else {
      if (espacioRestante > 100) y += 20; else y += 15;
  }

  const firmaY = y + 25;
  const anchoFirma = 70;
  const xTutor = margin + 10;
  const xEst = pageWidth - margin - anchoFirma - 10;

  if (datos.firma_tutor_url) {
    try { doc.addImage(datos.firma_tutor_url, 'PNG', xTutor + 5, firmaY - 22, 60, 20); } catch(e){}
  }

  if (datos.firma_estudiante_url) {
    try { doc.addImage(datos.firma_estudiante_url, 'PNG', xEst + 5, firmaY - 22, 60, 20); } catch(e){}
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.setFontSize(8); 
  
  doc.line(xTutor, firmaY, xTutor + anchoFirma, firmaY);
  doc.setFont("helvetica", "bold");
  doc.text("Firma del Tutor(a)", xTutor + (anchoFirma/2), firmaY + 5, { align: "center" });

  doc.line(xEst, firmaY, xEst + anchoFirma, firmaY);
  doc.text("Firma del estudiante tutorado", xEst + (anchoFirma/2), firmaY + 5, { align: "center" });

  // Guardar
  if (retornarDoc) {
      return doc;
  } else {
      doc.save(`F03_ENTREVISTA_${estudiante.codigo_estudiante}.pdf`);
  }
};