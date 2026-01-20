import { useState, useEffect } from 'react';
import api from './api/axios';
import './App.css';

// --- VISTAS PRINCIPALES ---
import Login from './components/Login';
import DashboardMaestro from './components/DashboardMaestro';
import CalendarioAcademico from './components/CalendarioAcademico';
import AdminDashboard from './components/AdminDashboard';

// --- MODALES ---
import ModalRegistro from './components/ModalRegistro';
import ModalHistorial from './components/ModalHistorial';
import ModalDerivacion from './components/ModalDerivacion';
import ModalFichaIntegral from './components/ModalFichaIntegral';
import ModalTutoriaGrupal from './components/ModalTutoriaGrupal';
import ModalFichaEntrevista from './components/ModalFichaEntrevista';

// --- LIBRERÍA DE NOTIFICACIONES ---
import { Toaster, toast } from 'sonner';
import Swal from 'sweetalert2';

// --- UTILIDADES Y GENERADORES ---
import { generarF01 } from './utils/generadorF01';
import { generarF04 } from './utils/generadorF04';
import { generarF05 } from './utils/generadorF05';
import { generarF02 } from './utils/generadorF02';
import { generarF03 } from './utils/generadorF03';

// --- RECURSOS ---
import logoCarrera from './assets/sistemas.png';

// IMPORTANTE: Define la URL de tu backend
const BACKEND_URL = 'http://localhost:3001';

function App() {
  // --- ESTADOS ---
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      if (saved) {
        const parsedUser = JSON.parse(saved);
        if (parsedUser && parsedUser.token) return parsedUser;
      }
    } catch (e) { console.error("Error sesión:", e); }
    localStorage.removeItem('user');
    return null;
  });

  const [estudiantes, setEstudiantes] = useState([]);
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [sesionAEditarEnModal, setSesionAEditarEnModal] = useState(null);

  // NUEVO ESTADO: Controla si el botón de remitir aparece o no
  const [informeEnviado, setInformeEnviado] = useState(false);

  // Estados de Modales
  const [mostrarModalRegistro, setMostrarModalRegistro] = useState(false);
  const [mostrarModalHistorial, setMostrarModalHistorial] = useState(false);
  const [mostrarModalDerivacion, setMostrarModalDerivacion] = useState(false);
  const [mostrarModalF01, setMostrarModalF01] = useState(false);
  const [mostrarModalGrupal, setMostrarModalGrupal] = useState(false);
  const [mostrarModalF03, setMostrarModalF03] = useState(false);

  const [datosPendientesPDF, setDatosPendientesPDF] = useState(null);
  const [vistaActual, setVistaActual] = useState('dashboard');
  // --- FUNCIÓN LOGIN ---
  const handleLogin = async (username, password) => {
    try {
      const { data } = await api.post('/auth/login', { username, password });
      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));

      const esAdmin = (data.roles?.nombre_rol === 'ADMIN') || (data.rol_id === 1);
      if (esAdmin) {
        setVistaActual('admin');
      } else {
        setVistaActual('dashboard');
        // Verificamos si ya envió informe al loguearse
        verificarEstadoInforme(data.tutor_id || data.id);
      }
      toast.success(`Bienvenido, ${data.nombre}`);
    } catch (err) {
      console.error(err);
      toast.error("Error de acceso o credenciales incorrectas");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setVistaActual('dashboard');
    setEstudiantes([]);
    setEstudianteSeleccionado(null);
    setHistorial([]);
    setUser(null);
    setInformeEnviado(false); // Reset al salir
  };

  useEffect(() => {
    let intervaloPolling;

    if (user && user.token) {
      cargarEstudiantes();
      const esAdmin = (user.roles?.nombre_rol === 'ADMIN') || (user.rol_id === 1);

      if (esAdmin && vistaActual !== 'admin') {
        setVistaActual('admin');
      } else if (!esAdmin) {
        // LÓGICA DE ACTUALIZACIÓN AUTOMÁTICA (POLLING)
        const tutorId = user.tutor_id || user.id;

        // 1. Verificación inmediata al cargar
        verificarEstadoInforme(tutorId);

        // 2. Verificación periódica cada 3 segundos
        // Esto hace que si el admin devuelve el informe, el botón cambie solo.
        intervaloPolling = setInterval(() => {
          verificarEstadoInforme(tutorId);
        }, 3000);
      }
    }

    // Limpieza: Detener el reloj cuando se cierre sesión o cambie el usuario
    return () => {
      if (intervaloPolling) clearInterval(intervaloPolling);
    };
  }, [user]);

  // --- FUNCIÓN ACTUALIZADA: VERIFICAR SI YA ENVIÓ ---
  const verificarEstadoInforme = async (tutorId) => {
    if (!tutorId) return;
    try {
      const res = await api.get(`/tutores/${tutorId}/estado-informe`);
      // IMPORTANTE: Actualizamos el estado directamente con lo que diga el servidor.
      // Si el admin lo borró, res.data.enviado será false y el botón cambiará.
      setInformeEnviado(!!res.data.enviado);
    } catch (error) {
      console.error("No se pudo verificar estado informe", error);
    }
  };
  const convertirUrlABase64 = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (error) { console.error("No se pudo convertir la imagen:", error); return null; }
  };

  const cargarEstudiantes = async () => {
    if (!user || !user.token) return;
    if (user.roles?.nombre_rol === 'ADMIN' || user.rol_id === 1) return;

    try {
      const tutorId = user.tutor_id || user.id;
      const res = await api.get(`/estudiantes?tutor_id=${tutorId}&_=${Date.now()}`);

      if (!res.data) return;

      const actualizados = res.data.map(est => {
        const derivacionesProcesadas = (est.derivaciones || []).map(d => ({
          ...d,
          tipo_formato: 'F05',
          titulo_visual: `F05 - ${d.area_destino || 'General'}`,
          firma_tutor_url: d.firma_tutor_url || d.firma_tutor
        }));

        const sesionesGrupales = (est.asistencia_grupal || []).map(asistencia => {
          if (!asistencia.sesion_grupal) return null;
          return {
            ...asistencia.sesion_grupal,
            tipo_formato: 'F02',
            titulo_visual: `F02 - ${asistencia.sesion_grupal.tema || 'Grupal'}`,
            key_unificada: `f02-${asistencia.id}`
          };
        }).filter(Boolean);

        const sesionesIndividuales = (est.sesiones_tutoria || []).map(s => {
          const base = s.tipo_formato || 'F04';
          let visual = base;
          if (base === 'F04' && s.motivo_consulta) {
            visual = `F04 - ${s.motivo_consulta.substring(0, 15)}...`;
          } else if (base === 'F03') {
            visual = `F03 - Entrevista Personal`;
          }
          return {
            ...s,
            tipo_formato: base,
            titulo_visual: visual,
            firma_tutor_url: s.firma_tutor_url || s.firma_tutor
          };
        });

        const todasLasSesiones = [...sesionesIndividuales, ...derivacionesProcesadas, ...sesionesGrupales]
          .sort((a, b) => new Date(b.fecha || b.fecha_solicitud || 0) - new Date(a.fecha || a.fecha_solicitud || 0));

        return { ...est, sesiones: todasLasSesiones };
      });

      setEstudiantes(actualizados);

      if (estudianteSeleccionado) {
        const estFresco = actualizados.find(e => Number(e.id) === Number(estudianteSeleccionado.id));
        if (estFresco) setEstudianteSeleccionado(estFresco);
      }
    } catch (err) {
      console.error("Error al cargar estudiantes:", err);

      // --- MANEJO DE SESIÓN EXPIRADA ---
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        toast.error("Tu sesión ha expirado. Por favor ingresa nuevamente.");
        handleLogout();
      }
    }
  };

  const refrescarHistorial = async (estId) => {
    if (!estId) return;
    try {
      const resIndividuales = await api.get(`/sesiones/${estId}`);
      const listaCruda = resIndividuales.data || [];

      const individualesProcesados = listaCruda.map(item => {
        const etiqueta = item.tipo_formato || 'F04';
        let visual = etiqueta;
        if (etiqueta === 'F05') visual = `F05 - ${item.area_destino || 'General'}`;
        else if (etiqueta === 'F04' && item.motivo_consulta) visual = `F04 - ${item.motivo_consulta.substring(0, 15)}...`;
        else if (etiqueta === 'F03') visual = 'F03 - Entrevista Personal';

        return {
          ...item,
          tipo_formato: etiqueta,
          titulo_visual: visual,
          firma_tutor_url: item.firma_tutor_url || item.firma_tutor
        };
      });

      let grupales = [];
      const resFresca = await api.get('/estudiantes');
      const listaEstudiantes = resFresca.data || [];
      const estudianteFresco = listaEstudiantes.find(e => String(e.id) === String(estId));

      if (estudianteFresco && estudianteFresco.asistencia_grupal) {
        grupales = estudianteFresco.asistencia_grupal.map(asistencia => {
          const sesion = asistencia.sesion_grupal;
          if (!sesion) return null;
          const evidenciaFullUrl = sesion.evidencia_url
            ? (sesion.evidencia_url.startsWith('http') ? sesion.evidencia_url : `${BACKEND_URL}${sesion.evidencia_url}`)
            : null;
          return {
            id: sesion.id,
            tipo_formato: 'F02',
            titulo_visual: `F02 - ${sesion.tema || 'Grupal'}`,
            tema: sesion.tema,
            fecha: sesion.fecha,
            hora_inicio: sesion.hora_inicio,
            hora_cierre: sesion.hora_cierre,
            area: sesion.area_tema,
            firma_tutor_url: sesion.firma_tutor_url,
            evidencia_url: evidenciaFullUrl,
            estudiantes_asistentes: sesion.asistentes ? sesion.asistentes.map(a => a.estudiantes) : []
          };
        }).filter(Boolean);
      }

      const historialCompleto = [...individualesProcesados, ...grupales].sort((a, b) => {
        const fechaA = new Date(a.fecha || a.fecha_solicitud || 0);
        const fechaB = new Date(b.fecha || b.fecha_solicitud || 0);
        return fechaB - fechaA;
      });
      setHistorial(historialCompleto);
    } catch (err) {
      console.error("Error historial:", err);
      toast.error("No se pudo cargar el historial.");
    }
  };
  const manejarGuardarGrupal = async (datos) => {
    try {
      const formData = new FormData();
      formData.append('tutor_id', user.tutor_id || user.id);
      Object.keys(datos).forEach(key => {
        if (key === 'asistentes_ids') formData.append(key, JSON.stringify(datos[key]));
        else if (key === 'archivo_evidencia') {
          if (datos[key] && typeof datos[key] !== 'string') formData.append('evidencia', datos[key]);
        }
        else if (key === 'firma_img') formData.append('firma_tutor_url', datos[key]);
        else if (datos[key] !== null) formData.append(key, datos[key]);
      });
      const metodo = datos.id ? 'put' : 'post';
      const ruta = datos.id ? `/sesiones-grupales/${datos.id}` : '/sesiones-grupales';
      const res = await api[metodo](ruta, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.status === 200 || res.status === 201) {
        const asistentesCompletos = estudiantes.filter(e => datos.asistentes_ids.map(String).includes(String(e.id)));
        let evidenciaParaPDF = null;
        if (datos.archivo_evidencia && typeof datos.archivo_evidencia !== 'string') {
          evidenciaParaPDF = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(datos.archivo_evidencia);
          });
        } else if (datos.id && sesionAEditarEnModal?.evidencia_url) {
          const urlCompleta = sesionAEditarEnModal.evidencia_url.startsWith('http') ? sesionAEditarEnModal.evidencia_url : `${BACKEND_URL}${sesionAEditarEnModal.evidencia_url}`;
          evidenciaParaPDF = await convertirUrlABase64(urlCompleta);
        }
        const datosParaPDF = { ...datos, firma_img: datos.firma_img, firma_tutor_url: datos.firma_img, foto_pdf: evidenciaParaPDF, nombre_tutor: user.nombre };
        setDatosPendientesPDF({ sesion: datosParaPDF, asistentes: asistentesCompletos });
        await cargarEstudiantes();
        toast.success("Tutoría Grupal guardada correctamente");
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error F02:", err);
      toast.error("Error al guardar la tutoría grupal");
      return false;
    }
  };

  const finalizarYDescargarPDF = () => {
    if (datosPendientesPDF) {
      generarF02(datosPendientesPDF.sesion, datosPendientesPDF.asistentes);
      toast.success("Generando PDF...");
    }
    setTimeout(() => {
      setMostrarModalGrupal(false);
      setDatosPendientesPDF(null);
      setSesionAEditarEnModal(null);
    }, 500);
  };

  const manejarGuardarF03 = async (datos) => {
    try {
      const ruta = '/sesiones-tutoria/f03';
      const payload = {
        ...datos,
        tipo_formato: 'F03',
        fecha: datos.fecha ? new Date(datos.fecha).toISOString() : new Date().toISOString(),
        id: datos.id
      };
      const res = await api.post(ruta, payload);
      if (res.status === 200 || res.status === 201) {
        generarF03(payload, estudianteSeleccionado);
        await cargarEstudiantes();
        setMostrarModalF03(false);
        setSesionAEditarEnModal(null);
        toast.success(datos.id ? "Entrevista actualizada" : "Entrevista guardada correctamente");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error F03:", error);
      toast.error("No se pudo guardar la entrevista.");
      return false;
    }
  };

  const manejarEliminarRegistro = async (registro) => {
    if (!registro || !registro.id) return;
    if (!window.confirm(`¿Estás seguro de eliminar este registro permanentemente?`)) return;

    const toastId = toast.loading("Eliminando y refrescando datos...");

    try {
      let ruta = registro.tipo_formato === 'F02' ? `/sesiones-grupales/${registro.id}` :
        (registro.tipo_formato === 'F05' || registro.tipo_formato === 'Derivación' ? `/derivaciones/${registro.id}` : `/sesiones/${registro.id}`);

      const res = await api.delete(ruta);

      if (res.status === 200 || res.status === 204) {
        await cargarEstudiantes();
        setHistorial(prev => prev.filter(item => item.id !== registro.id));
        toast.success("Registro eliminado y tabla actualizada", { id: toastId });
      }
    } catch (err) {
      console.error("Error al eliminar:", err);
      toast.error("No se pudo eliminar el registro", { id: toastId });
    }
  };
  const manejarGuardarSesion = async (datos) => {
    try {
      // 1. RECUPERAR USUARIO (TUTOR)
      const userStr = localStorage.getItem('usuario') || localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : {};
      const tutorId = parseInt(user.tutor_id || user.id);

      if (!tutorId) {
        toast.error("No se identificó al tutor. Reinicie sesión.");
        return;
      }

      const esDerivacion = datos.tipo_formato === 'F05';
      const esEdicion = !!datos.id;

      // 2. MANEJO DE FECHA
      let fechaFinalISO;
      try {
        const posibleFecha = datos.fecha_manual || datos.fecha_solicitud || datos.fecha;
        const fechaObj = new Date(posibleFecha);
        fechaFinalISO = (!posibleFecha || isNaN(fechaObj.getTime())) ? new Date().toISOString() : fechaObj.toISOString();
      } catch (error) { fechaFinalISO = new Date().toISOString(); }

      let ruta;
      let metodo;
      let payload;

      if (esDerivacion) {
        // --- LÓGICA PARA F05 (DERIVACIÓN) ---
        ruta = esEdicion ? `/derivaciones/${datos.id}` : '/derivaciones';
        metodo = esEdicion ? 'put' : 'post';

        // === CORRECCIÓN SEMESTRE DESDE F01 ===
        let semestreFinal = datos.semestre || estudianteSeleccionado.ciclo_actual;
        
        // Si no tenemos semestre, lo buscamos dentro de la Ficha F01 guardada
        if (!semestreFinal) {
            const fichaF01 = estudianteSeleccionado.sesiones?.find(s => s.tipo_formato === 'F01');
            if (fichaF01?.desarrollo_entrevista) {
                try {
                    const f01Data = typeof fichaF01.desarrollo_entrevista === 'string'
                        ? JSON.parse(fichaF01.desarrollo_entrevista)
                        : fichaF01.desarrollo_entrevista;
                    
                    // Buscamos campos comunes de semestre/ciclo
                    semestreFinal = f01Data.ciclo || f01Data.semestre || f01Data.ciclo_actual;
                } catch (e) { console.warn("No se pudo leer semestre de F01", e); }
            }
        }
        // Valor por defecto si falla todo
        if (!semestreFinal) semestreFinal = "No registrado";

        payload = {
          estudiante_id: parseInt(estudianteSeleccionado.id),
          tutor_id: tutorId,
          motivo_derivacion: datos.motivo_derivacion || datos.motivo_consulta || "Sin motivo",
          nombre_tutor_deriva: datos.nombre_tutor_deriva || user.nombre || user.nombres_apellidos,
          fecha_solicitud: fechaFinalISO,
          area_destino: datos.area_destino || "No especificado",
          firma_tutor_url: datos.firma_tutor_url,
          escuela_profesional: datos.escuela_profesional || estudianteSeleccionado.escuela_profesional,
          semestre: semestreFinal, // <--- SEMESTRE RECUPERADO DE F01
          celular: datos.celular,
          edad: parseInt(datos.edad || 0),
          fecha_nacimiento: datos.fecha_nacimiento,
          tipo_formato: 'F05'
        };

      } else {
        // --- LÓGICA PARA F04 Y F03 ---
        ruta = datos.tipo_formato === 'F03' ? '/sesiones-tutoria/f03' : '/sesiones-tutoria/f04';
        metodo = 'post';

        let desarrolloString = datos.desarrollo_entrevista;
        if (desarrolloString && typeof desarrolloString === 'object') {
            desarrolloString = JSON.stringify(desarrolloString);
        }

        payload = {
          ...datos,
          id: datos.id ? parseInt(datos.id) : undefined,
          tipo_formato: datos.tipo_formato || 'F04',
          fecha: fechaFinalISO,
          tutor_id: tutorId,
          estudiante_id: parseInt(estudianteSeleccionado.id),
          edad: parseInt(datos.edad || 0),
          desarrollo_entrevista: desarrolloString
        };
      }

      // 3. ENVIAR AL BACKEND
      const res = await api[metodo](ruta, payload);

      if (res.status === 200 || res.status === 201) {
        
        // 4. GENERAR PDF
        if (!esDerivacion) {
          const numSeguimiento = (estudianteSeleccionado.sesiones?.filter(s => s.tipo_formato === 'F04').length || 0) + (esEdicion ? 0 : 1);
          try {
             if (datos.tipo_formato === 'F04' && typeof generarF04 === 'function') {
                 generarF04(payload, estudianteSeleccionado, false, String(numSeguimiento)); 
             } else if (datos.tipo_formato === 'F03' && typeof generarF03 === 'function') {
                 generarF03(payload, estudianteSeleccionado);
             }
          } catch(e) { console.error("Error PDF", e); }
        } else {
          if (typeof generarF05 === 'function') generarF05(payload, estudianteSeleccionado);
        }

        toast.success(`${esDerivacion ? 'Derivación' : 'Sesión'} guardada correctamente`);
        
        await cargarEstudiantes();
        setMostrarModalRegistro(false);
        setMostrarModalDerivacion(false);
        setSesionAEditarEnModal(null);
      }

    } catch (err) {
      console.error("Error al guardar:", err);
      const msg = err.response?.data?.detalle || err.response?.data?.error || err.message;
      toast.error(`Error: ${msg}`);
    }
  };

  const manejarGuardarF01 = async (datosFicha) => {
    const toastId = toast.loading("Sincronizando Ficha Integral...");
    try {
      const payload = {
        ...datosFicha,
        estudiante_id: estudianteSeleccionado.id,
        tutor_id: user.tutor_id || user.id,
        tipo_formato: 'F01',
        firma_tutor_url: datosFicha.firma_tutor_url,
        firma_estudiante_url: datosFicha.firma_estudiante_url
      };

      const res = await api.post('/sesiones-tutoria/f01', payload);

      if (res.data.success) {
        const dataFinal = res.data.data;
        await cargarEstudiantes();
        setMostrarModalF01(false);
        toast.success("Ficha y Firmas guardadas", { id: toastId });
        generarF01(dataFinal, { ...estudianteSeleccionado, ...datosFicha });
      }
    } catch (error) {
      toast.error("Error al guardar");
    }
  };

  const manejarActualizarSesion = async (datos) => {
    try {
      const esDerivacion = datos.tipo_formato === 'F05' || datos.tipo_formato === 'Derivación';
      const ruta = esDerivacion ? `/derivaciones/${datos.id}` : `/sesiones/${datos.id}`;
      const res = await api.put(ruta, datos);
      if (res.status === 200) {
        toast.success("Registro actualizado con éxito");
        await cargarEstudiantes();
        if (estudianteSeleccionado) await refrescarHistorial(estudianteSeleccionado.id);
        return true;
      }
    } catch (err) { toast.error("No se pudieron guardar los cambios"); return false; }
  };
  // --- ESCUDO DE SEGURIDAD ---
  if (!user) {
    return (
      <>
        <Toaster position="bottom-right" richColors />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  // --- FUNCIÓN REMITIR INFORME (FORMAL: TEXTO + ARCHIVO) ---
  const handleRemitirInforme = async () => {
    const { value: formValues } = await Swal.fire({
      title: '📤 Remitir Informe Final',
      html: `
        <div style="text-align: left; font-size: 14px; color: #334155;">
          <p style="margin-bottom: 5px; font-weight: bold;">1. Conclusiones y Logros (Texto Breve):</p>
          <textarea id="swal-obs" class="swal2-textarea" style="margin: 0 0 15px 0; width: 100%; font-size: 13px;" placeholder="Ej: Se cumplió con el 100% de atenciones..."></textarea>
          
          <p style="margin-bottom: 5px; font-weight: bold;">2. Adjuntar Informe Formal (PDF/Word):</p>
          <input type="file" id="swal-file" class="swal2-input" style="margin: 0; font-size: 13px;" accept=".pdf,.doc,.docx">
          <p style="font-size: 11px; color: #64748b; margin-top: 5px;">* Opcional: Suba su informe detallado firmado.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '🚀 Enviar Todo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0f172a',
      focusConfirm: false,
      preConfirm: () => {
        return {
          observaciones: document.getElementById('swal-obs').value,
          archivo: document.getElementById('swal-file').files[0]
        };
      }
    });

    if (!formValues) return;

    const toastId = toast.loading("Enviando informe y archivos...");

    try {
      const totalEstudiantes = estudiantes.length;
      const atendidos = estudiantes.filter(e => e.sesiones && e.sesiones.length > 0).length;
      const enRiesgo = estudiantes.filter(e => e.sesiones?.some(s => s.tipo_formato === 'F05')).length;
      const avance = totalEstudiantes > 0 ? Math.round((atendidos / totalEstudiantes) * 100) : 0;

      const formData = new FormData();
      formData.append('tutor_id', user.tutor_id || user.id);
      formData.append('semestre', '2025-I');
      formData.append('total_estudiantes', totalEstudiantes);
      formData.append('total_atendidos', atendidos);
      formData.append('total_riesgo', enRiesgo);
      formData.append('avance', avance);
      formData.append('observaciones', formValues.observaciones || "Sin comentarios.");

      if (formValues.archivo) {
        formData.append('informe_adjunto', formValues.archivo);
      }

      const res = await api.post('/tutores/remitir-ciclo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.status === 200 || res.status === 201) {
        setInformeEnviado(true);
        toast.dismiss(toastId);
        Swal.fire('¡Recibido!', 'Tu informe y adjuntos han sido enviados correctamente.', 'success');
      }
    } catch (error) {
      console.error("Error al remitir:", error);
      toast.dismiss(toastId);
      toast.error(`Error: ${error.response?.data?.error || "No se pudo enviar."}`);
    }
  };

  return (
    <div style={styles.appContainer}>
      <Toaster position="bottom-right" richColors />

      {/* --- SIDEBAR --- */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logoContainer}>
            <img src="/logo_unajma.png" style={styles.logoImg} alt="UNAJMA" title="Universidad Nacional José María Arguedas" />
            <div style={styles.logoSeparator}></div>
            <img src={logoCarrera} style={styles.logoImg} alt="Carrera" title="Escuela Profesional" />
          </div>
          <div style={{ marginTop: '10px', textAlign: 'center' }}>
            <span style={styles.logoText}>Tutoría UNAJMA</span>
          </div>
          <div style={styles.docenteBadge}>
            <div style={styles.docenteAvatar}>{user.nombre?.charAt(0) || 'U'}</div>
            <div style={styles.docenteInfo}>
              <span style={{ fontSize: '12px', opacity: 0.7 }}>Bienvenido,</span>
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{user.nombre}</span>
            </div>
          </div>
        </div>

        <nav style={styles.navMenu}>
          {(() => {
            const esAdmin = (user.roles?.nombre_rol === 'ADMIN') || (user.rol_id === 1);

            return (
              <>
                {esAdmin && (
                  <div
                    onClick={() => setVistaActual('admin')}
                    style={vistaActual === 'admin' ? styles.navItemActive : styles.navItem}
                  >
                    <span style={{ marginRight: '12px' }}>⚙️</span> Panel Admin
                  </div>
                )}

                {!esAdmin && (
                  <div
                    onClick={() => setVistaActual('dashboard')}
                    style={vistaActual === 'dashboard' ? styles.navItemActive : styles.navItem}
                  >
                    <span style={{ marginRight: '12px' }}>📊</span> Panel de Tutoría
                  </div>
                )}

                <div
                  onClick={() => setVistaActual('calendario')}
                  style={vistaActual === 'calendario' ? styles.navItemActive : styles.navItem}
                >
                  <span style={{ marginRight: '12px' }}>📅</span> Calendario
                </div>

                {!esAdmin && (
                  <>
                    {informeEnviado ? (
                      <div
                        onClick={() => {
                          Swal.fire({
                            title: '✅ Informe Enviado',
                            text: 'Ya has remitido tu informe semestral. Está pendiente de revisión por el Administrador.',
                            icon: 'info',
                            confirmButtonColor: '#10b981'
                          });
                        }}
                        style={{
                          ...styles.navItem,
                          marginTop: '30px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          fontWeight: 'bold',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          opacity: 1,
                          boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)'
                        }}
                      >
                        <span style={{ marginRight: '12px' }}>✅</span> Informe Enviado
                      </div>
                    ) : (
                      <div
                        onClick={handleRemitirInforme}
                        style={{
                          ...styles.navItem,
                          marginTop: '30px',
                          backgroundColor: '#f59e0b',
                          color: 'white',
                          fontWeight: 'bold',
                          justifyContent: 'center',
                          boxShadow: '0 4px 6px rgba(245, 158, 11, 0.2)',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ marginRight: '12px' }}>📤</span> Remitir Informe
                      </div>
                    )}
                  </>
                )}
              </>
            );
          })()}
        </nav>
        <div style={styles.sidebarFooter}>
          <button onClick={handleLogout} style={styles.logoutBtn}><span style={{ marginRight: '10px' }}>🚪</span> Cerrar Sesión</button>
        </div>
      </aside>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <main style={styles.mainContent}>
        {vistaActual === 'admin' && ((user.roles?.nombre_rol === 'ADMIN') || (user.rol_id === 1)) && (
          <AdminDashboard />
        )}

        {vistaActual === 'dashboard' && (
          <DashboardMaestro
            user={user}
            estudiantes={estudiantes}
            bloqueado={informeEnviado} // <--- PASAMOS EL BLOQUEO AQUÍ
            onNuevaSesion={(est) => { setEstudianteSeleccionado(est); setSesionAEditarEnModal(null); setMostrarModalRegistro(true); }}
            onDerivar={(est, sesion = null) => {
              setEstudianteSeleccionado(est);
              setSesionAEditarEnModal(sesion);
              setMostrarModalDerivacion(true);
            }}
            onNuevaFichaIntegral={(est) => { setEstudianteSeleccionado(est); setSesionAEditarEnModal(null); setMostrarModalF01(true); }}
            onAbrirModalGrupal={() => { setSesionAEditarEnModal(null); setMostrarModalGrupal(true); }}
            onNuevaFichaEntrevista={(est) => { setEstudianteSeleccionado(est); setSesionAEditarEnModal(null); setMostrarModalF03(true); }}
            onVerHistorial={async (est) => { setEstudianteSeleccionado(est); await refrescarHistorial(est.id); setMostrarModalHistorial(true); }}
            onGuardarGrupal={manejarGuardarGrupal}
            onEliminarRegistro={manejarEliminarRegistro}
            onEditarFicha={(sesionClick, estudianteClick) => {
              const estFresco = estudiantes.find(e => e.id === estudianteClick.id) || estudianteClick;
              const sesionFresca = estFresco.sesiones?.find(s => s.id === sesionClick.id) || sesionClick;

              setEstudianteSeleccionado(estFresco);
              setSesionAEditarEnModal(sesionFresca);

              const tipo = sesionFresca.tipo_formato || '';

              if (tipo === 'F01') setMostrarModalF01(true);
              else if (tipo === 'F02') {
                const idGrupal = sesionFresca.id;
                const asistentesIds = estudiantes.filter(e => e.asistencia_grupal?.some(a => a.sesion_grupal_id === idGrupal)).map(e => e.id);
                setSesionAEditarEnModal({ ...sesionFresca, asistentes_ids: asistentesIds });
                setMostrarModalGrupal(true);
              }
              else if (tipo === 'F03') setMostrarModalF03(true);
              else if (tipo === 'F05' || tipo === 'Derivación') setMostrarModalDerivacion(true);
              else setMostrarModalRegistro(true);
            }}

            onDescargarPDF={(sesion, est) => {
              const tipo = sesion.tipo_formato || '';

              if (tipo === 'F01') {
                const desarrollo = typeof sesion.desarrollo_entrevista === 'string'
                  ? JSON.parse(sesion.desarrollo_entrevista)
                  : sesion.desarrollo_entrevista;
                generarF01(sesion, est);
              }
              else if (tipo === 'F02') generarF02(sesion, sesion.estudiantes_asistentes || []);
              else if (tipo === 'F03') {
                let datos = { ...sesion };
                if (sesion.observaciones?.startsWith('{')) try { datos = { ...datos, ...JSON.parse(sesion.observaciones) }; } catch (e) { }
                generarF03(datos, est);
              }
              else if (tipo === 'F05') generarF05(sesion, est);
              else generarF04(sesion, est);
            }}
          />
        )}

        {vistaActual === 'calendario' && (
          <CalendarioAcademico usuario={user} />
        )}

      </main>

      {/* --- RENDERIZADO DE MODALES --- */}
      {mostrarModalRegistro && <ModalRegistro estudiante={estudianteSeleccionado} onClose={() => { setMostrarModalRegistro(false); setSesionAEditarEnModal(null); }} onGuardar={manejarGuardarSesion} sesionAEditar={sesionAEditarEnModal} key={sesionAEditarEnModal ? `f04-edit-${sesionAEditarEnModal.id}` : 'f04-nuevo'} />}
      {mostrarModalDerivacion && <ModalDerivacion estudiante={estudianteSeleccionado} user={user} sesionAEditar={sesionAEditarEnModal} key={sesionAEditarEnModal ? `f05-${sesionAEditarEnModal.id}` : 'f05-nuevo'} onClose={() => { setMostrarModalDerivacion(false); setSesionAEditarEnModal(null); }} onGuardar={manejarGuardarSesion} />}
      {mostrarModalF01 && <ModalFichaIntegral key={sesionAEditarEnModal ? `f01-${sesionAEditarEnModal.id}-${Date.now()}` : 'f01-nuevo'} estudiante={estudianteSeleccionado} user={user} sesionAEditar={sesionAEditarEnModal} onClose={() => { setMostrarModalF01(false); setSesionAEditarEnModal(null); }} onGuardar={manejarGuardarF01} />}
      {mostrarModalF03 && <ModalFichaEntrevista estudiante={estudianteSeleccionado} user={user} sesionAEditar={sesionAEditarEnModal} onClose={() => { setMostrarModalF03(false); setSesionAEditarEnModal(null); }} onGuardar={manejarGuardarF03} />}
      {mostrarModalGrupal && <ModalTutoriaGrupal estudiantes={estudiantes} user={user} onGuardar={manejarGuardarGrupal} onClose={finalizarYDescargarPDF} sesionAEditar={sesionAEditarEnModal} />}
      {mostrarModalHistorial && <ModalHistorial estudiante={estudianteSeleccionado} historial={estudianteSeleccionado.sesiones} onClose={() => setMostrarModalHistorial(false)} onEliminar={manejarEliminarRegistro} onEditar={manejarActualizarSesion} onRefrescar={cargarEstudiantes} />}
    </div>
  );
}

const styles = {
  appContainer: { display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: '"Segoe UI", sans-serif', overflow: 'hidden' },
  sidebar: { width: '260px', backgroundColor: '#0f172a', color: '#f1f5f9', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 10px rgba(0,0,0,0.1)', zIndex: 20 },
  sidebarHeader: { padding: '24px', borderBottom: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '20px' },
  logoContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' },
  logoImg: { width: '45px', height: '45px', objectFit: 'contain' },
  logoSeparator: { width: '1px', height: '30px', backgroundColor: 'rgba(255,255,255,0.2)' },
  logoText: { fontSize: '16px', fontWeight: '700', color: 'white' },
  docenteBadge: { backgroundColor: '#1e293b', padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' },
  docenteAvatar: { width: '32px', height: '32px', backgroundColor: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' },
  docenteInfo: { display: 'flex', flexDirection: 'column' },
  navMenu: { flexGrow: 1, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  navItem: { padding: '14px 16px', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center' },
  navItemActive: { padding: '14px 16px', backgroundColor: '#1e293b', color: '#38bdf8', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', borderLeft: '4px solid #38bdf8' },
  sidebarFooter: { padding: '24px', borderTop: '1px solid #1e293b' },
  logoutBtn: { width: '100%', padding: '12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  mainContent: { flex: 1, overflow: 'hidden', position: 'relative' }
};

export default App;