import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Define la URL de tu backend para completar las rutas relativas
// Asegúrate de que esta URL sea correcta según tu entorno (dev/prod)
const BACKEND_URL = "http://localhost:3001"; 

// --- FUNCIÓN HELPER PARA CARGAR IMAGEN ASÍNCRONA ---
// Esto asegura que la imagen se descargue completamente antes de insertarla en el PDF
const cargarImagen = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Vital para evitar problemas de CORS
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = () => {
        console.warn(`No se pudo cargar la imagen: ${url}`);
        resolve(null); // Si falla, devuelve null para no romper el PDF
    };
  });
};
export const generarF02 = async (sesion, asistentes = []) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  // --- FUNCIÓN HELPER PARA DIBUJAR ENCABEZADO REUTILIZABLE ---
  const dibujarEncabezado = () => {
    try {
      // Intenta cargar el logo desde la carpeta pública
      // Asegúrate de que 'logo_unajma.png' esté en tu carpeta 'public'
      doc.addImage('/logo_unajma.png', 'PNG', 15, 10, 22, 22);
    } catch (e) { console.warn("Logo no encontrado"); }

    doc.setFontSize(9).setFont("helvetica", "bold");
    doc.text("UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS", 42, 15);
    doc.setFontSize(8).setFont("helvetica", "normal");
    doc.text("Dirección de Bienestar Universitario", 42, 20);
    doc.text("Área de Tutoría", 42, 25);
    doc.setFontSize(10).setFont("helvetica", "bold");
    doc.text("ÁREA DE TUTORÍA", pageWidth - 55, 15);
    
    // Línea separadora institucional
    doc.setLineWidth(0.5);
    doc.line(15, 32, pageWidth - 15, 32);
  };

  // --- PÁGINA 1: FORMATO INSTITUCIONAL OFICIAL ---
  
  // 1. Encabezado
  dibujarEncabezado();

  doc.setFontSize(11).text("FICHA DE TUTORÍA GRUPAL (Formato 02)", pageWidth / 2, 42, { align: "center" });
  // 2. Bloque de Datos con Líneas
  doc.setFontSize(10);
  
  // Campo Tema
  doc.setFont("helvetica", "bold").text("Tema:", margin, 52);
  doc.setFont("helvetica", "normal").text(`${sesion.tema || ""}`, margin + 15, 52);
  doc.setLineWidth(0.2); // Línea fina para datos
  doc.line(margin + 12, 53, pageWidth - margin, 53);

  // Fecha, Hora Inicio y Hora Cierre
  // Manejo seguro de la fecha
  let fechaFmt = "__/__/____";
  if (sesion.fecha) {
      // Intenta crear la fecha, manejando posibles formatos ISO o strings
      const fechaObj = new Date(sesion.fecha);
      // Ajuste básico para zona horaria si es necesario, o usar UTC
      // .getUTCDate() a veces es mejor si la fecha viene como YYYY-MM-DD sin hora
      fechaFmt = !isNaN(fechaObj.getTime()) ? fechaObj.toLocaleDateString('es-ES', { timeZone: 'UTC' }) : sesion.fecha;
  }

  doc.setFont("helvetica", "bold").text("Fecha:", margin, 64);
  doc.setFont("helvetica", "normal").text(fechaFmt, margin + 15, 64);
  doc.line(margin + 13, 65, margin + 45, 65);

  doc.setFont("helvetica", "bold").text("Hora de inicio", margin + 50, 64);
  doc.setFont("helvetica", "normal").text(sesion.hora_inicio || "_______", margin + 75, 64);
  doc.line(margin + 74, 65, margin + 100, 65);

  doc.setFont("helvetica", "bold").text("Hora de cierre", margin + 105, 64);
  doc.setFont("helvetica", "normal").text(sesion.hora_cierre || "_______", margin + 130, 64);
  doc.line(margin + 129, 65, pageWidth - margin, 65);

  // Área del tema con Checkboxes simulados
  const area = (sesion.area_tema || "").toLowerCase();
  doc.setFont("helvetica", "bold").text("Área del tema:", margin, 76);
  doc.setFont("helvetica", "normal");
  
  // Dibujamos las opciones. La 'X' marca la seleccionada.
  doc.text(`Académica ( ${area.includes('acad') ? 'X' : ' '} )`, margin + 35, 76);
  doc.text(`Personal ( ${area.includes('pers') ? 'X' : ' '} )`, margin + 85, 76);
  doc.text(`Profesional ( ${area.includes('prof') ? 'X' : ' '} )`, margin + 135, 76);
  // 3. Tabla de Asistencia
  doc.setFont("helvetica", "bold").text("LISTA DE ASISTENCIA DE TUTORADOS", pageWidth / 2, 90, { align: "center" });
  
  autoTable(doc, {
    startY: 95,
    head: [['N°', 'NOMBRES Y APELLIDOS', 'DNI', 'CÓDIGO']],
    body: asistentes.map((est, index) => [
      String(index + 1).padStart(2, '0'),
      est.nombres_apellidos?.toUpperCase() || "",
      est.dni || "",
      est.codigo_estudiante || ""
    ]),
    theme: 'grid',
    headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', halign: 'center', lineWidth: 0.1, lineColor: 0 },
    styles: { fontSize: 8, cellPadding: 2, textColor: 0, lineWidth: 0.1, lineColor: 0 },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 35, halign: 'center' },
      3: { cellWidth: 35, halign: 'center' }
    }
  });

  let currentY = doc.lastAutoTable.finalY + 10;

  // 4. Nota y Contadores de Tutorados
  doc.setFontSize(8).setFont("helvetica", "italic");
  doc.text("Nota: Puede utilizar este formato o capturas de pantalla.", margin, currentY);
  
  currentY += 12;
  doc.setFontSize(10).setFont("helvetica", "bold");
  doc.text(`N° de tutorados asignados:`, margin, currentY);
  doc.setFont("helvetica", "normal").text(`${sesion.total_asignados || "0"}`, margin + 50, currentY);
  doc.line(margin + 48, currentY + 1, margin + 70, currentY + 1);

  currentY += 10;
  doc.text(`N° de tutorados que asistieron a la tutoría grupal:`, margin, currentY);
  doc.setFont("helvetica", "normal").text(`${sesion.total_asistentes || "0"}`, margin + 85, currentY);
  doc.line(margin + 83, currentY + 1, margin + 105, currentY + 1);

  // 5. Firma Centrada
  // Verificamos espacio antes de firmar para no quedar cortado
  if (currentY > 250) {
      doc.addPage();
      dibujarEncabezado();
      currentY = 50;
  } else {
      currentY += 35;
  }

  const firmaY = currentY;
  const centerX = pageWidth / 2;
  
  // LÓGICA FIRMA: Busca tanto el nombre de BD como el local
  const firmaParaMostrar = sesion.firma_tutor_url || sesion.firma_img;

  if (firmaParaMostrar) {
    try {
        doc.addImage(firmaParaMostrar, 'PNG', centerX - 25, firmaY - 22, 50, 20);
    } catch (e) { console.warn("Error al cargar firma en PDF"); }
  }
  doc.line(centerX - 40, firmaY, centerX + 40, firmaY);
  doc.setFont("helvetica", "bold").text("Firma del Tutor(a)", centerX, firmaY + 5, { align: "center" });
  // --- PARTE 2: ANEXO FOTOGRÁFICO EN HOJA NUEVA ---
  
  // 'foto_pdf' suele venir si es una imagen nueva en Base64 (desde el input file)
  let imagenAnexo = sesion.foto_pdf; 

  // Si no hay foto nueva, intentamos cargar la URL del servidor (edición sin cambio de foto)
  // 'evidencia_url' es la ruta relativa guardada en BD
  if (!imagenAnexo && sesion.evidencia_url) {
      // Construimos la URL completa para fetch
      // Asegúrate de que tu backend sirva archivos estáticos correctamente
      const urlCompleta = sesion.evidencia_url.startsWith('http') 
          ? sesion.evidencia_url 
          : `${BACKEND_URL}${sesion.evidencia_url}`;
      
      console.log("Cargando imagen de anexo desde:", urlCompleta);

      // ESPERAMOS a que la imagen cargue antes de seguir
      const imgElement = await cargarImagen(urlCompleta);
      if (imgElement) {
          imagenAnexo = imgElement;
      }
  }

  // Solo si logramos obtener una imagen (Base64 o Elemento Cargado) generamos la hoja
  if (imagenAnexo) {
    doc.addPage();
    
    // 1. DIBUJAR ENCABEZADO TAMBIÉN EN EL ANEXO
    dibujarEncabezado();

    // 2. TÍTULO DEL ANEXO
    doc.setFontSize(12).setFont("helvetica", "bold");
    doc.text("ANEXO: EVIDENCIA FOTOGRÁFICA", pageWidth / 2, 45, { align: "center" });
    doc.setLineWidth(0.2);
    doc.line(margin, 48, pageWidth - margin, 48);

    try {
      // 3. IMAGEN
      // Si es string (Base64) usa JPEG (común para fotos), si es Objeto (Imagen cargada) jsPDF lo detecta
      const formato = typeof imagenAnexo === 'string' ? 'JPEG' : 'PNG';
      
      // Ajustamos la imagen para que quepa en la página manteniendo márgenes
      // x, y, ancho, alto
      doc.addImage(imagenAnexo, formato, margin, 60, pageWidth - (margin * 2), 110);
      
      doc.setFontSize(10).setFont("helvetica", "italic");
      doc.text(`Evidencia de la sesión grupal - Tema: ${sesion.tema || ""}`, margin, 180);
    } catch (e) {
      console.error("Error al insertar foto en PDF:", e);
      doc.setFontSize(10).setTextColor(150);
      doc.text("(No se pudo cargar la imagen de evidencia)", pageWidth / 2, 100, { align: "center" });
    }
  }

  // Guardar Archivo
  // Reemplazamos barras en la fecha para que sea un nombre de archivo válido
  const nombreFecha = (typeof fechaFmt === 'string') ? fechaFmt.replace(/\//g, '-') : 'fecha';
  doc.save(`F02_Tutoria_Grupal_${nombreFecha}.pdf`);
};