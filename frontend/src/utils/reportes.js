import { jsPDF } from "jspdf";

const configurarEncabezado = (doc, img) => {
    doc.addImage(img, 'PNG', 15, 8, 22, 22);
    doc.setFontSize(10).setFont("helvetica", "bold");
    doc.text("UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS", 42, 15);
    doc.setFontSize(9).setFont("helvetica", "normal");
    doc.text("Dirección de Bienestar Universitario / Área de Tutoría", 42, 20);
    doc.setLineWidth(0.5);
    doc.line(15, 32, 195, 32);
};

export const descargarFormato04 = (sesion, estudiante) => {
    const doc = new jsPDF();
    const img = new Image();
    img.src = "/logo_unajma.png";
    img.onload = () => {
        configurarEncabezado(doc, img);
        doc.setFontSize(14).setFont("helvetica", "bold");
        doc.text("FICHA DE SEGUIMIENTO DE TUTORÍA INDIVIDUAL (Formato 04)", 105, 45, { align: "center" });
        doc.setFontSize(11).setFont("helvetica", "normal");
        doc.text(`Estudiante: ${estudiante.nombres_apellidos}`, 20, 60);
        doc.text(`Fecha: ${new Date(sesion.fecha).toLocaleDateString()}`, 20, 76);
        doc.rect(15, 85, 180, 40);
        doc.text("Aspectos abordados:", 20, 92);
        doc.text(sesion.motivo_consulta, 20, 100, { maxWidth: 170 });
        doc.rect(15, 130, 180, 40);
        doc.text("Acuerdos:", 20, 137);
        doc.text(sesion.acuerdos_compromisos, 20, 145, { maxWidth: 170 });
        doc.save(`F04_${estudiante.codigo_estudiante}.pdf`);
    };
};
export const descargarFormato02 = (datosGrupal, estudiantesAsistentes) => {
    const doc = new jsPDF();
    const img = new Image();
    img.src = "/logo_unajma.png";
    
    img.onload = () => {
        // Membrete
        doc.addImage(img, 'PNG', 15, 10, 22, 22);
        doc.setFontSize(10).setFont("helvetica", "bold");
        doc.text("UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS", 42, 15);
        doc.setFontSize(9).setFont("helvetica", "normal");
        doc.text("Dirección de Bienestar Universitario / Área de Tutoría", 42, 20);
        doc.line(15, 32, 195, 32);

        // Título Formato 02
        doc.setFontSize(14).setFont("helvetica", "bold");
        doc.text("FICHA DE TUTORÍA GRUPAL (Formato 02)", 105, 42, { align: "center" });

        // Información de la Sesión [cite: 110, 111, 112]
        doc.setFontSize(11).setFont("helvetica", "normal");
        doc.text(`Tema: ${datosGrupal.tema}`, 20, 52);
        doc.text(`Fecha: ${datosGrupal.fecha}`, 20, 60);
        doc.text(`Hora: ${datosGrupal.horaInicio} - ${datosGrupal.horaCierre}`, 100, 60);
        doc.text(`Área: ${datosGrupal.area}`, 20, 68);

        // Tabla de Asistencia [cite: 113, 114]
        doc.setFont("helvetica", "bold").text("LISTA DE ASISTENCIA DE TUTORADOS", 105, 80, { align: "center" });
        
        let y = 85;
        doc.rect(15, y, 10, 8); doc.text("N°", 17, y+6);
        doc.rect(25, y, 90, 8); doc.text("NOMBRES Y APELLIDOS", 27, y+6);
        doc.rect(115, y, 35, 8); doc.text("DNI", 117, y+6);
        doc.rect(150, y, 45, 8); doc.text("CÓDIGO", 152, y+6);

        y += 8;
        doc.setFont("helvetica", "normal");
        estudiantesAsistentes.forEach((est, i) => {
            doc.rect(15, y, 10, 8); doc.text(`${i+1}`, 18, y+6);
            doc.rect(25, y, 90, 8); doc.text(est.nombres_apellidos, 27, y+6);
            doc.rect(115, y, 35, 8); doc.text(est.dni || "---", 117, y+6);
            doc.rect(150, y, 45, 8); doc.text(est.codigo_estudiante, 152, y+6);
            y += 8;
        });

        // Firma [cite: 119]
        doc.line(75, 250, 135, 250);
        doc.text("Firma del Tutor(a)", 105, 258, { align: "center" });

        doc.save(`Formato02_${datosGrupal.tema.replace(/ /g, '_')}.pdf`);
    };
};
export const descargarFormato05 = (estudiante, tutorNombre, datosDerivacion) => {
    const doc = new jsPDF();
    const img = new Image();
    img.src = "/logo_unajma.png";
    
    img.onload = () => {
        // Membrete Institucional
        doc.addImage(img, 'PNG', 15, 10, 22, 22);
        doc.setFontSize(10).setFont("helvetica", "bold");
        doc.text("UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS", 42, 15);
        doc.setFontSize(9).setFont("helvetica", "normal");
        doc.text("Dirección de Bienestar Universitario / Área de Tutoría", 42, 20);
        doc.line(15, 32, 195, 32);

        // Título Formato 05
        doc.setFontSize(14).setFont("helvetica", "bold");
        doc.text("FICHA DE DERIVACIÓN DE TUTORÍA INDIVIDUAL (formato 05)", 105, 45, { align: "center" });

        // Datos del Estudiante [cite: 121, 123, 124]
        doc.setFontSize(11).setFont("helvetica", "normal");
        doc.text(`Nombre y Apellidos del Tutorado: ${estudiante.nombres_apellidos}`, 20, 60);
        doc.text(`Escuela Profesional: ${estudiante.escuela_profesional}`, 20, 68);
        doc.text(`Código: ${estudiante.codigo_estudiante}`, 20, 76);
        doc.text(`Fecha de derivación: ${new Date().toLocaleDateString()}`, 20, 84);
        doc.text(`Tutor que deriva: ${tutorNombre}`, 20, 92);

        // Motivo de Derivación [cite: 127]
        doc.setFont("helvetica", "bold").text("Motivo de Derivación:", 20, 105);
        doc.setFont("helvetica", "normal").text(datosDerivacion.motivo, 20, 112, { maxWidth: 170 });

        // Oficinas de Derivación 
        doc.setFont("helvetica", "bold").text("Marque la Oficina a quien deriva el caso:", 20, 140);
        const oficinas = ["Medicina", "Nutrición", "Odontología", "Psicología", "Psicopedagogía", "Servicio Social"];
        let xPos = 20;
        let yPos = 150;

        oficinas.forEach((oficina, index) => {
            const isSelected = datosDerivacion.oficina === oficina;
            doc.rect(xPos, yPos - 4, 4, 4); // Casillero
            if (isSelected) doc.text("X", xPos + 1, yPos - 1); // Check
            doc.text(oficina, xPos + 6, yPos);
            
            xPos += 60;
            if ((index + 1) % 3 === 0) {
                xPos = 20;
                yPos += 10;
            }
        });

        // Firma [cite: 136]
        doc.line(75, 220, 135, 220);
        doc.text("Firma del Tutor(a)", 105, 228, { align: "center" });

        doc.save(`Derivacion_${estudiante.codigo_estudiante}.pdf`);
    };
};