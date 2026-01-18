import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';
import api from '../api/axios';

// --- IMPORTACIONES CORREGIDAS ---
import { generarF01 } from './generadorF01';
import { generarF02 } from './generadorF02';
import { generarF03 } from './generadorF03';
import { generarF04 } from './generadorF04'; // <--- AHORA IMPORTA DESDE EL ARCHIVO RENOMBRADO
import { generarF05 } from './generadorF05';

export const descargarPortafolioZip = async (tutorId) => {
    const toastId = toast.loading("⏳ Conectando con el servidor...");

    try {
        const response = await api.get(`/admin/tutor/${tutorId}/portafolio`);
        const { tutor, estudiantes } = response.data;

        if (!estudiantes || estudiantes.length === 0) {
            toast.dismiss(toastId);
            toast.warning("Este tutor no tiene estudiantes o datos registrados.");
            return;
        }

        toast.loading(`Generando documentos para ${estudiantes.length} estudiantes...`, { id: toastId });

        const zip = new JSZip();
        const nombreTutorLimpio = (tutor.nombres_apellidos || 'DOCENTE').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
        const carpetaRaiz = zip.folder(`PORTAFOLIO_${nombreTutorLimpio}`);

        let totalDocumentos = 0;

        for (const est of estudiantes) {
            const nombreEstudiante = (est.nombres_apellidos || 'ESTUDIANTE').replace(/[^a-zA-Z0-9]/g, '_');
            const carpetaEst = carpetaRaiz.folder(`${est.codigo_estudiante}_${nombreEstudiante}`);
            const sesiones = est.sesiones_tutoria || [];

            // A. F01 - Ficha Integral
            const sesionF01 = sesiones.find(s => s.tipo_formato === 'F01');
            if (sesionF01) {
                try {
                    const pdfDoc = generarF01(sesionF01, est, true);
                    if (pdfDoc) {
                        carpetaEst.file("F01_Ficha_Integral.pdf", pdfDoc.output('blob'));
                        totalDocumentos++;
                    }
                } catch (e) { console.error("Error F01", e); }
            }

            // B. F02 - Grupal
            // ... (Lógica F02 igual)

            // C. F03 - Entrevista
            const sesionesF03 = sesiones.filter(s => s.tipo_formato === 'F03');
            sesionesF03.forEach((ses, index) => {
                try {
                    const pdfDoc = generarF03(ses, est, true);
                    if (pdfDoc) {
                        carpetaEst.file(`F03_Entrevista_${index + 1}.pdf`, pdfDoc.output('blob'));
                        totalDocumentos++;
                    }
                } catch (e) { console.error("Error F03", e); }
            });

            // D. F04 - Seguimiento (AQUÍ PASAMOS EL NÚMERO CORRELATIVO)
            const sesionesF04 = sesiones.filter(s => s.tipo_formato === 'F04' || s.tipo_formato === 'Sesión Individual');
            sesionesF04.forEach((ses, index) => {
                try {
                    // Pasamos 'index + 1' como cuarto argumento para que el PDF diga "Seguimiento N°: 1, 2..."
                    const pdfDoc = generarF04(ses, est, true, index + 1);
                    if (pdfDoc) {
                        const numStr = String(index + 1).padStart(2, '0');
                        carpetaEst.file(`F04_Seguimiento_${numStr}.pdf`, pdfDoc.output('blob'));
                        totalDocumentos++;
                    }
                } catch (e) { console.error("Error F04", e); }
            });

            // E. F05 - Derivación
            const sesionesF05 = sesiones.filter(s => s.tipo_formato === 'F05' || s.tipo_formato === 'Derivación');
            sesionesF05.forEach((ses, index) => {
                try {
                    const pdfDoc = generarF05(ses, est, true);
                    if (pdfDoc) {
                        carpetaEst.file(`F05_Derivacion_${index + 1}.pdf`, pdfDoc.output('blob'));
                        totalDocumentos++;
                    }
                } catch (e) { console.error("Error F05", e); }
            });
        }

        if (totalDocumentos === 0) {
            toast.dismiss(toastId);
            toast.info("Se encontraron estudiantes, pero no tienen fichas generadas.");
            return;
        }

        toast.loading(`Comprimiendo ${totalDocumentos} documentos...`, { id: toastId });
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `Portafolio_${nombreTutorLimpio}.zip`);
        toast.success("✅ Descarga iniciada", { id: toastId });

    } catch (error) {
        console.error("Error portafolio:", error);
        toast.dismiss(toastId);
        toast.error("Error al generar el portafolio.");
    }
};