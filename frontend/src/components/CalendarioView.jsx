import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../api/axios';
import { toast } from 'sonner';

import ModalAccionesCita from './ModalAccionesCita';
import ModalNuevaCita from './ModalNuevaCita';

moment.locale('es');
moment.updateLocale('es', {
  week: { dow: 1, doy: 4 }
});
const localizer = momentLocalizer(moment);

const mensajesEspanol = {
  allDay: 'Todo el día',
  previous: 'Anterior',
  next: 'Siguiente',
  today: 'Hoy',
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  agenda: 'Agenda',
  date: 'Fecha',
  time: 'Hora',
  event: 'Evento',
  noEventsInRange: 'No hay citas en este rango',
  showMore: total => `+ Ver más (${total})`
};
export default function CalendarioView({ estudiantes = [], user, onAgendarSesion }) {
  const [eventos, setEventos] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [citaSeleccionada, setCitaSeleccionada] = useState(null);

  useEffect(() => {
    cargarCitas();
  }, []);

  const cargarCitas = async () => {
    try {
      const res = await api.get('/citas');
      console.log("Citas recibidas:", res.data);
      const eventosFormateados = res.data.map(cita => ({
        id: cita.id,
        title: cita.titulo_cita,
        start: new Date(cita.fecha_hora_inicio),
        end: new Date(cita.fecha_hora_fin),
        resource: cita
      }));
      setEventos(eventosFormateados);
    } catch (error) {
      console.error("Error citas:", error);
    }
  };

  const enviarRecordatorioWA = (estIdDesdeCita, fecha, hora) => {
  const estReal = estudiantes.find(e => Number(e.id) === Number(estIdDesdeCita));
  const eventoCita = eventos?.find(ev => Number(ev.resource?.estudiante_id) === Number(estIdDesdeCita));
  const detallesCita = eventoCita?.resource;

  if (!estReal) return toast.error("Estudiante no encontrado");

  const num = estReal.telefono || estReal.celular;
  const numeroLimpio = num.toString().replace(/\D/g, '');
  const tutorNombre = user?.nombre || user?.username || "Tutor de la Facultad";

  // --- ESTRUCTURA CON IDENTIDAD INSTITUCIONAL ---
  const mensajeCompleto = encodeURIComponent(
    `🏛️ *UNAJMA - TUTORÍA UNIVERSITARIA*\n` +
    `🎓 *E.P. INGENIERÍA DE SISTEMAS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Hola *${estReal.nombres_apellidos}*,\n` +
    `Te saluda tu tutor: *${tutorNombre}*.\n\n` +
    `Te recuerdo tu cita programada:\n` +
    `📝 *Sesión:* ${detallesCita?.titulo_cita || 'Ficha Integral'}\n` +
    `📅 *Fecha:* ${moment(fecha).format('DD/MM/YYYY')}\n` +
    `⏰ *Hora:* ${hora}\n` +
    `📍 *Lugar:* ${detallesCita?.lugar || 'Oficina de Tutoría'}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ _Por favor, confirma tu asistencia._\n\n` +
    `🌐 *Sistemas UNAJMA:* https://unajma.edu.pe`
  );

  // Abrimos WhatsApp con el mensaje estructurado
  window.open(`https://wa.me/51${numeroLimpio}?text=${mensajeCompleto}`, '_blank');
  
  console.log(`🚀 Recordatorio institucional enviado a: ${estReal.nombres_apellidos}`);
};

  const manejarGuardarNuevaCita = async (datos) => {
    const inicio = new Date(`${datos.fecha}T${datos.hora}`);
    const fin = new Date(inicio.getTime() + datos.duracion * 60000);
    try {
      await api.post('/citas', {
        estudiante_id: datos.estudiante_id,
        titulo: datos.titulo,
        inicio,
        fin
      });
      toast.success("Cita programada");
      setModalAbierto(false);
      cargarCitas();
    } catch (error) { toast.error("Error al guardar"); }
  };

  const eventStyleGetter = (event) => {
    let backgroundColor = '#3b82f6';
    const titulo = (event.title || '').toLowerCase();
    if (titulo.includes('f02')) backgroundColor = '#10b981';
    else if (titulo.includes('f03')) backgroundColor = '#f59e0b';
    else if (titulo.includes('f01')) backgroundColor = '#6366f1';
    return { style: { backgroundColor, borderRadius: '7px', color: 'white', border: 'none', display: 'block' } };
  };
  return (
    <div style={styles.dashboardWrapper}>
      <header style={styles.statsHeader}>
        <div style={styles.titleGroup}>
          <h2 style={styles.mainTitle}>Calendario de Tutoría</h2>
          <p style={styles.subTitle}>Centro de Gestión y Seguimiento Académico</p>
        </div>
        <div style={styles.pillContainer}>
          <button onClick={() => setModalAbierto(true)} style={styles.btnNuevaCita}>+ Nueva Cita</button>
        </div>
      </header>

      <div style={styles.mainGrid}>
        <section style={styles.calendarSection}>
          <Calendar
            localizer={localizer}
            events={eventos}
            culture='es'
            messages={mensajesEspanol}
            style={{ height: '100%' }}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={(evento) => setCitaSeleccionada(evento)}
          />
        </section>

        <aside style={styles.sidePanel}>
          <h3 style={styles.panelTitle}>Seguimiento</h3>
          <div style={styles.listSection}>
            <p style={styles.listLabel}>CITAS PRÓXIMAS</p>
            {eventos
              .filter(e => moment(e.start).isSameOrAfter(moment(), 'day'))
              .sort((a, b) => moment(a.start).valueOf() - moment(b.start).valueOf())
              .slice(0, 5)
              .map(evento => {
                const idEstCita = evento.resource?.estudiante_id;
                const estReal = estudiantes.find(e => Number(e.id) === Number(idEstCita));

                let numeroParaMostrar = "Sin número";
                if (estReal) {
                  const f01 = estReal.sesiones?.find(s => s.tipo_formato === 'F01');
                  const telFicha = f01?.desarrollo_entrevista ?
                    (typeof f01.desarrollo_entrevista === 'string' ? JSON.parse(f01.desarrollo_entrevista).telefono : f01.desarrollo_entrevista.telefono)
                    : null;
                  numeroParaMostrar = telFicha || estReal.telefono || estReal.celular || "Sin número";
                }

                const tieneF01 = !!estReal?.sesiones?.some(s => s.tipo_formato === 'F01');

                return (
                  <div key={evento.id} style={styles.followUpCard}>
                    <div style={styles.cardHeader}>
                      <div style={styles.userAvatar}>{estReal?.nombres_apellidos?.charAt(0) || 'E'}</div>
                      <div style={styles.userInfo}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={styles.userName}>{estReal?.nombres_apellidos || 'Estudiante'}</div>
                          <span style={tieneF01 ? styles.badgeF01 : styles.badgeOld}>
                            {tieneF01 ? 'F01 OK' : 'S/F01'}
                          </span>
                        </div>
                        <div style={{ marginTop: '2px' }}>
                          <span style={{ fontWeight: 'bold', color: '#059669', fontSize: '13px' }}>
                            📞 {numeroParaMostrar}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => enviarRecordatorioWA(idEstCita, evento.start, moment(evento.start).format('HH:mm'))}
                        style={styles.waBtn}
                      >📲</button>
                    </div>
                  </div>
                );
              })}
            {eventos.length === 0 && <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>No hay citas registradas</p>}
          </div>
        </aside>
      </div>

      {citaSeleccionada && (
        <ModalAccionesCita
          cita={citaSeleccionada}
          onClose={() => setCitaSeleccionada(null)}
          onSeleccionar={(tipo, est) => { setCitaSeleccionada(null); onAgendarSesion(est, tipo); }}
          onEliminar={async (id) => {
            if (window.confirm("¿Desea eliminar esta cita?")) {
              await api.delete(`/citas/${id}`);
              cargarCitas();
              setCitaSeleccionada(null);
            }
          }}
        />
      )}

      {modalAbierto && (
        <ModalNuevaCita
          estudiantes={estudiantes}
          onClose={() => setModalAbierto(false)}
          onGuardar={manejarGuardarNuevaCita}
        />
      )}
    </div>
  );
}
const styles = {
  dashboardWrapper: { padding: '30px', backgroundColor: '#f1f5f9', height: '100vh', display: 'flex', flexDirection: 'column', gap: '25px', boxSizing: 'border-box', overflow: 'hidden' },
  statsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  titleGroup: { display: 'flex', flexDirection: 'column' },
  mainTitle: { margin: 0, fontSize: '24px', fontWeight: '800', color: '#1e293b' },
  subTitle: { margin: 0, fontSize: '13px', color: '#64748b' },
  pillContainer: { display: 'flex', gap: '10px' },
  btnNuevaCita: { backgroundColor: '#004a99', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' },
  mainGrid: { display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', flex: 1, minHeight: 0 },
  calendarSection: { backgroundColor: 'white', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflow: 'hidden' },
  sidePanel: { backgroundColor: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' },
  panelTitle: { margin: 0, fontSize: '18px', fontWeight: '700' },
  listSection: { display: 'flex', flexDirection: 'column', gap: '10px' },
  listLabel: { fontSize: '11px', fontWeight: '800', color: '#94a3b8' },
  followUpCard: { padding: '12px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '10px' },
  userAvatar: { width: '35px', height: '35px', borderRadius: '10px', backgroundColor: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800' },
  userInfo: { flex: 1 },
  userName: { fontSize: '13px', fontWeight: '700', color: '#334155' },
  badgeF01: { fontSize: '9px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' },
  badgeOld: { fontSize: '9px', backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' },
  waBtn: { backgroundColor: '#25D366', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' }
};