import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';
import api from '../api/axios';

// --- IMPORTACIÓN DE TODOS LOS GENERADORES ---
import { generarF01 } from './generadorF01'; // Ficha Integral
import { generarF02 } from './generadorF02'; // Asistencia / Grupal
import { generarF03 } from './generadorF03'; // Entrevista
import { generarF04 } from './generadorF04'; // Seguimiento
import { generarF05 } from './generadorF05'; // Derivación

export const descargarPortafolioZip = async (tutorId) => {
    const toastId = toast.loading("⏳ Recopilando evidencias del servidor...");

    try {
        // 1. Obtener toda la data del backend
        const { data } = await api.get(`/admin/tutor/${tutorId}/portafolio`);
        const { tutor, estudiantes } = data;

        if (!estudiantes || estudiantes.length === 0) {
            toast.dismiss(toastId);
            toast.warning("Este tutor no tiene estudiantes o datos registrados.");
            return;
        }

        toast.loading(`Procesando documentos de ${estudiantes.length} estudiantes...`, { id: toastId });

        // 2. Iniciar ZIP
        const zip = new JSZip();
        
        // Carpeta Raíz con nombre del Tutor
        const nombreTutorLimpio = (tutor.nombres_apellidos || 'DOCENTE').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
        const carpetaRaiz = zip.folder(`PORTAFOLIO_${nombreTutorLimpio}`);

        // 3. Iterar por cada estudiante
        let totalDocumentos = 0;

        estudiantes.forEach((est) => {
            // Crear carpeta por estudiante: "CODIGO_APELLIDOS"
            const nombreEstudiante = (est.nombres_apellidos || 'ESTUDIANTE').replace(/[^a-zA-Z0-9]/g, '_');
            const nombreCarpeta = `${est.codigo_estudiante}_${nombreEstudiante}`;
            const carpetaEst = carpetaRaiz.folder(nombreCarpeta);

            // Obtenemos las sesiones del estudiante
            const sesiones = est.sesiones_tutoria || [];

            // ----------------------------------------------------
            // A. FICHA INTEGRAL (F01)
            // ----------------------------------------------------
            const sesionF01 = sesiones.find(s => s.tipo_formato === 'F01');
            if (sesionF01) {
                try {
                    let datosF01 = {};
                    try { datosF01 = JSON.parse(sesionF01.desarrollo_entrevista); } catch(e) {}
                    
                    // F01 usa (datosMezclados, estudiante, returnDoc)
                    const pdfDoc = generarF01({ ...sesionF01, ...datosF01 }, est, true); 
                    if (pdfDoc) {
                        carpetaEst.file("F01_Ficha_Integral.pdf", pdfDoc.output('blob'));
                        totalDocumentos++;
                    }
                } catch (err) { console.error("Error generando F01", err); }
            }

            // ----------------------------------------------------
            // B. TUTORÍA GRUPAL / ASISTENCIA (F02)
            // ----------------------------------------------------
            const sesionesF02 = sesiones.filter(s => s.tipo_formato === 'F02' || s.tipo_formato === 'Tutoría Grupal');
            sesionesF02.forEach((ses, index) => {
                try {
                    // F02 usa (sesion, returnDoc) - Nota: a veces no usa 'est' si es acta general
                    const pdfDoc = generarF02(ses, true); 
                    if (pdfDoc) {
                        carpetaEst.file(`F02_Grupal_${index + 1}_${ses.fecha.split('T')[0]}.pdf`, pdfDoc.output('blob'));
                        totalDocumentos++;
                    }
                } catch (err) { console.error("Error generando F02", err); }
            });

            // ----------------------------------------------------
            // C. FICHA DE ENTREVISTA (F03)
            // ----------------------------------------------------
            const sesionesF03 = sesiones.filter(s => s.tipo_formato === 'F03' || s.tipo_formato === 'Entrevista');
            sesionesF03.forEach((ses, index) => {
                try {
                    // F03 usa (sesion, estudiante, returnDoc)
                    const pdfDoc = generarF03(ses, est, true);
                    if (pdfDoc) {
                        carpetaEst.file(`F03_Entrevista_${index + 1}_${ses.fecha.split('T')[0]}.pdf`, pdfDoc.output('blob'));
                        totalDocumentos++;
                    }
                } catch (err) { console.error("Error generando F03", err); }
            });

            // ----------------------------------------------------
            // D. FICHA DE SEGUIMIENTO (F04)
            // ----------------------------------------------------
            const sesionesF04 = sesiones.filter(s => s.tipo_formato === 'F04' || s.tipo_formato === 'Sesión Individual');
            sesionesF04.forEach((ses, index) => {
                try {
                    // F04 usa (sesion, estudiante, returnDoc)
                    const pdfDoc = generarF04(ses, est, true);
                    if (pdfDoc) {
                        carpetaEst.file(`F04_Seguimiento_${index + 1}_${ses.fecha.split('T')[0]}.pdf`, pdfDoc.output('blob'));
                        totalDocumentos++;
                    }
                } catch (err) { console.error("Error generando F04", err); }
            });

            // ----------------------------------------------------
            // E. FICHA DE DERIVACIÓN (F05)
            // ----------------------------------------------------
            const sesionesF05 = sesiones.filter(s => s.tipo_formato === 'F05' || s.tipo_formato === 'Derivación');
            sesionesF05.forEach((ses, index) => {
                try {
                    // F05 usa (sesion, estudiante, returnDoc)
                    const pdfDoc = generarF05(ses, est, true);
                    if (pdfDoc) {
                        carpetaEst.file(`F05_Derivacion_${index + 1}_${ses.fecha.split('T')[0]}.pdf`, pdfDoc.output('blob'));
                        totalDocumentos++;
                    }
                } catch (err) { console.error("Error generando F05", err); }
            });
        });

        // 4. Generar el archivo ZIP final
        if (totalDocumentos === 0) {
            toast.dismiss(toastId);
            toast.info("No se encontraron fichas generadas para descargar.");
            return;
        }

        toast.loading(`Comprimiendo ${totalDocumentos} documentos...`, { id: toastId });
        
        const content = await zip.generateAsync({ type: "blob" });
        const nombreArchivo = `Portafolio_${nombreTutorLimpio}_${new Date().getFullYear()}.zip`;
        
        saveAs(content, nombreArchivo);

        toast.success("✅ Portafolio descargado correctamente", { id: toastId });

    } catch (error) {
        console.error(error);
        toast.error("Error al generar el portafolio", { id: toastId });
    }
};