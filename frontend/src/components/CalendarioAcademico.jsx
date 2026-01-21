import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import es from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../api/axios';
import { toast } from 'sonner';
// ASEGÚRATE DE QUE ESTA RUTA EXISTE EN TU PROYECTO
import ModalNuevaCita from './ModalNuevaCita';

// --- CONFIGURACIÓN DE IDIOMA ---
const locales = { 'es': es };
const localizer = dateFnsLocalizer({
    format, parse, startOfWeek, getDay, locales,
});

// --- MENSAJES DEL CALENDARIO ---
const messages = {
    allDay: 'Todo el día', previous: 'Ant', next: 'Sig', today: 'Hoy',
    month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda',
    date: 'Fecha', time: 'Hora', event: 'Evento',
    noEventsInRange: 'No hay actividades en este rango.',
};

// --- COMPONENTE VISUAL DE EVENTO ---
const CustomEvent = ({ event }) => (
    <div title={event.title} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
        <span style={{ fontSize: '14px' }}>{event.tipo === 'GLOBAL' ? '📢' : '👤'}</span>
        <span style={{ fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</span>
    </div>
);

// --- ESTILOS CSS ---
const customStyles = `
  .rbc-calendar { font-family: 'Inter', sans-serif; background: white; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; overflow: hidden; }
  .rbc-toolbar { padding: 20px; background: #fff; border-bottom: 1px solid #f1f5f9; margin-bottom: 0 !important; }
  .rbc-toolbar-label { font-size: 20px; font-weight: 800; color: #1e293b; text-transform: capitalize; }
  .rbc-btn-group button { border: none !important; background: transparent; color: #64748b; font-weight: 600; padding: 8px 16px; border-radius: 8px !important; margin: 0 2px; cursor: pointer; }
  .rbc-btn-group button:hover { background-color: #f1f5f9; color: #0f172a; }
  .rbc-btn-group button.rbc-active { background-color: #eff6ff; color: #2563eb; font-weight: 800; }
  .rbc-header { padding: 15px 0; font-size: 13px; font-weight: 700; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; }
  .rbc-month-view { border: none; }
  .rbc-off-range-bg { background: #fcfcfc; }
  .rbc-today { background-color: #f0f9ff !important; }
  .rbc-event { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border-radius: 6px; border: none !important; padding: 4px 8px; transition: transform 0.1s; }
  .rbc-event:hover { transform: translateY(-1px); z-index: 10; cursor: pointer; }
  .time-input { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; width: 100%; font-family: 'Inter', sans-serif; color: #334155; font-weight: 600; }
  @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
`;

const CalendarioAcademico = ({ usuario }) => {
    // --- ESTADOS ---
    const [eventos, setEventos] = useState([]);

    // ESTADOS DE CONTROL (Navegación manual para arreglar botones)
    const [fechaActual, setFechaActual] = useState(new Date());
    const [vistaActual, setVistaActual] = useState(Views.MONTH);

    // Modales
    const [modalAdminAbierto, setModalAdminAbierto] = useState(false);
    const [mostrarModalCita, setMostrarModalCita] = useState(false);

    // Drawer
    const [eventoSeleccionado, setEventoSeleccionado] = useState(null);

    // Formulario y Datos
    const [eventoIdEdicion, setEventoIdEdicion] = useState(null);
    const [nuevoEvento, setNuevoEvento] = useState({ title: '', start: new Date(), end: new Date() });
    const [estudiantes, setEstudiantes] = useState([]);

    // --- NUEVO: Estado para guardar la fecha donde hiciste clic ---
    const [fechaSeleccionadaParaModal, setFechaSeleccionadaParaModal] = useState(new Date());

    // Rol
    const esAdmin = usuario?.roles?.nombre_rol === 'ADMIN' || usuario?.rol_id === 1;

    // --- CARGA ---
    // CalendarioAcademico.jsx
    useEffect(() => {
        // Solo cargar si el usuario tiene un ID numérico válido
        if (usuario?.id && !isNaN(parseInt(usuario.id))) {
            cargarDatosCompletos();
        }
    }, [usuario?.id]); // Solo se ejecuta si el ID cambia // Asegúrate de que la dependencia sea el ID y no todo el objeto

    const cargarDatosCompletos = async () => {
        try {
            let eventosGlobales = [];
            let citasPersonales = [];

            try {
                const resEventos = await api.get(`/eventos?usuario_id=${usuario.id}&es_admin=${esAdmin}`);
                eventosGlobales = resEventos.data.map(e => ({
                    id: e.id, title: e.titulo, start: new Date(e.inicio), end: new Date(e.fin),
                    tipo: e.tipo || 'GLOBAL', data: e, color: e.color || '#ef4444'
                }));
            } catch (err) { console.warn("Error eventos globales"); }

            if (!esAdmin) {
                try {
                    const resEst = await api.get('/estudiantes');
                    setEstudiantes(resEst.data);
                    const resCitas = await api.get('/citas');
                    citasPersonales = resCitas.data.map(c => ({
                        id: c.id, title: `👤 ${c.estudiantes?.nombres_apellidos || 'Estudiante'}`,
                        start: new Date(c.fecha_hora_inicio), end: new Date(c.fecha_hora_fin),
                        tipo: 'CITA', data: c, color: '#2563eb'
                    }));
                } catch (err) { console.warn("Error citas"); }
            }
            setEventos([...citasPersonales, ...eventosGlobales]);
        } catch (error) { console.error("Error general calendario"); }
    };

    // --- MANEJADORES ---
    const manejarNavegacion = (nuevaFecha) => setFechaActual(nuevaFecha);
    const manejarVista = (nuevaVista) => setVistaActual(nuevaVista);

    // AQUÍ ESTÁ LA SOLUCIÓN DEL PROBLEMA
    const manejarSeleccionSlot = ({ start, end }) => {
        if (esAdmin) {
            // Lógica Admin (ya funcionaba)
            const esDiaEntero = start.getHours() === 0 && start.getMinutes() === 0;
            let fechaInicio = new Date(start);
            let fechaFin = new Date(end);
            if (esDiaEntero) {
                fechaInicio.setHours(8, 0, 0);
                fechaFin = new Date(fechaInicio);
                fechaFin.setHours(9, 0, 0);
            }
            setEventoIdEdicion(null);
            setNuevoEvento({ title: '', start: fechaInicio, end: fechaFin });
            setModalAdminAbierto(true);
        } else {
            // Lógica Tutor: Capturamos la fecha del clic
            console.log("Fecha clickeada:", start); // Debug
            setFechaSeleccionadaParaModal(start); // <--- GUARDAMOS LA FECHA
            setMostrarModalCita(true);
        }
    };

    const manejarSeleccionEvento = (evento) => setEventoSeleccionado(evento);

    const enviarWhatsApp = () => {
        if (!eventoSeleccionado) return;
        const tipoReal = eventoSeleccionado.tipo || eventoSeleccionado.type;

        if (tipoReal === 'CITA') {
            const est = eventoSeleccionado.data.estudiantes;
            const rawNumero = est?.telefono || est?.celular || est?.whatsapp;
            if (!rawNumero) {
                toast.warning(`⚠️ El estudiante ${est?.nombres_apellidos} no tiene número.`);
                return;
            }
            const numero = String(rawNumero).replace(/\D/g, '');
            let fechaStr = "";
            try { fechaStr = format(eventoSeleccionado.start, "EEEE d 'de' MMMM, h:mm a", { locale: es }); } catch (e) { }
            const mensaje = `Hola *${est.nombres_apellidos}*, le saluda su Tutor.\n\nLe recuerdo su cita de tutoría para el *${fechaStr}*.\n\n📌 *Motivo:* ${eventoSeleccionado.data.titulo_cita || 'Seguimiento'}.`;

            const url = `https://api.whatsapp.com/send?phone=51${numero}&text=${encodeURIComponent(mensaje)}`;
            const win = window.open(url, '_blank');
            if (!win) toast.error("🚫 Navegador bloqueó la ventana emergente.");
        }
        else if (tipoReal === 'GLOBAL' && esAdmin) {
            const mensaje = `📢 *COMUNICADO*: ${eventoSeleccionado.title}`;
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`, '_blank');
        }
    };

    const eliminarItem = async () => {
        if (!eventoSeleccionado || !window.confirm("¿Eliminar registro?")) return;
        try {
            const endpoint = (eventoSeleccionado.tipo || eventoSeleccionado.type) === 'CITA'
                ? `/citas/${eventoSeleccionado.id}` : `/eventos/${eventoSeleccionado.id}`;
            await api.delete(endpoint);
            toast.success("Eliminado");
            setEventoSeleccionado(null);
            cargarDatosCompletos();
        } catch (e) { toast.error("Error al eliminar"); }
    };

    const guardarCitaTutor = async (datos) => {
        try {
            const inicio = new Date(`${datos.fecha}T${datos.hora}`);
            const fin = new Date(inicio.getTime() + datos.duracion * 60000);
            await api.post('/citas', {
                estudiante_id: datos.estudiante_id, titulo: datos.titulo,
                inicio: inicio.toISOString(), fin: fin.toISOString(), lugar: 'Oficina Tutoría'
            });
            toast.success("Cita agendada");
            setMostrarModalCita(false);
            cargarDatosCompletos();
        } catch (e) { toast.error("Error al agendar"); }
    };

    const guardarEventoAdmin = async () => {
        if (!nuevoEvento.title) return toast.warning("Título requerido");
        try {
            const payload = {
                titulo: nuevoEvento.title, inicio: nuevoEvento.start, fin: nuevoEvento.end,
                tipo: 'GLOBAL', creador_id: usuario.id, color: '#e11d48'
            };
            if (eventoIdEdicion) await api.put(`/eventos/${eventoIdEdicion}`, payload);
            else await api.post('/eventos', payload);
            toast.success("Evento guardado");
            setModalAdminAbierto(false);
            cargarDatosCompletos();
        } catch (e) { toast.error("Error al guardar"); }
    };

    const cambiarHora = (tipo, valorHora) => {
        if (!valorHora) return;
        const [h, m] = valorHora.split(':').map(Number);
        const nueva = new Date(nuevoEvento[tipo]);
        nueva.setHours(h, m);
        if (tipo === 'start' && nueva > nuevoEvento.end) {
            const fin = new Date(nueva); fin.setHours(h + 1);
            setNuevoEvento({ ...nuevoEvento, start: nueva, end: fin });
        } else { setNuevoEvento({ ...nuevoEvento, [tipo]: nueva }); }
    };
    const obtenerHoraString = (d) => d ? `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}` : "08:00";

    return (
        <div style={{ height: 'calc(100vh - 40px)', padding: '20px', backgroundColor: '#f1f5f9', display: 'flex', overflow: 'hidden' }}>
            <style>{customStyles}</style>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingRight: eventoSeleccionado ? '20px' : '0', transition: 'all 0.3s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <div>
                        <h1 style={{ margin: 0, color: '#0f172a', fontWeight: '800', fontSize: '26px', letterSpacing: '-1px' }}>
                            {esAdmin ? '🏛️ Agenda Institucional' : '📅 Mi Agenda de Tutoría'}
                        </h1>
                        <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '14px' }}>Panel de Gestión 2026</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={styles.legendBadge(true)}>📢 Institucional</div>
                        {!esAdmin && <div style={styles.legendBadge(false)}>👤 Mis Citas</div>}
                    </div>
                </div>

                <Calendar
                    localizer={localizer}
                    events={eventos}
                    date={fechaActual}
                    view={vistaActual}
                    onNavigate={manejarNavegacion}
                    onView={manejarVista}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%', backgroundColor: 'white', padding: '20px', borderRadius: '16px' }}
                    culture='es'

                    // CAMBIO 1: Solo es seleccionable si NO es la Directora
                    selectable={usuario?.is_super_user ? false : true}

                    // CAMBIO 2: Bloqueamos la función de crear cita si es Directora
                    onSelectSlot={(slotInfo) => {
                        if (!usuario?.is_super_user) {
                            manejarSeleccionSlot(slotInfo);
                        }
                    }}

                    onSelectEvent={manejarSeleccionEvento}
                    views={['month', 'week', 'day', 'agenda']}
                    components={{ event: CustomEvent }}
                    messages={messages}
                    eventPropGetter={(event) => ({
                        style: {
                            backgroundColor: event.color,
                            color: 'white',
                            borderLeft: '5px solid rgba(0,0,0,0.2)',
                            cursor: usuario?.is_super_user ? 'default' : 'pointer' // El cursor cambia según el rol
                        }
                    })}
                />
            </div>

            {eventoSeleccionado && (
                <div style={styles.drawer}>
                    <div style={styles.drawerHeader}>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>Detalles</h3>
                        <button onClick={() => setEventoSeleccionado(null)} style={styles.closeBtn}>✕</button>
                    </div>
                    <div style={styles.drawerContent}>
                        <span style={{
                            padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase',
                            backgroundColor: (eventoSeleccionado.tipo || eventoSeleccionado.type) === 'CITA' ? '#eff6ff' : '#fef2f2',
                            color: (eventoSeleccionado.tipo || eventoSeleccionado.type) === 'CITA' ? '#2563eb' : '#ef4444'
                        }}>
                            {(eventoSeleccionado.tipo || eventoSeleccionado.type) === 'CITA' ? 'Cita Estudiante' : 'Evento Global'}
                        </span>

                        <h2 style={{ fontSize: '18px', color: '#1e293b', margin: '15px 0 5px 0', lineHeight: '1.3' }}>{eventoSeleccionado.title}</h2>
                        <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px 0', fontWeight: '500' }}>
                            📅 {format(eventoSeleccionado.start, 'EEEE d MMMM, h:mm a', { locale: es })}
                        </p>

                        {(eventoSeleccionado.tipo || eventoSeleccionado.type) === 'CITA' && (
                            <div style={styles.cardInfo}>
                                <div style={styles.rowInfo}><strong>Estudiante:</strong> {eventoSeleccionado.data.estudiantes?.nombres_apellidos}</div>
                                <div style={styles.rowInfo}><strong>Código:</strong> {eventoSeleccionado.data.estudiantes?.codigo_estudiante}</div>
                                <div style={styles.rowInfo}><strong>Celular:</strong> <span style={{ fontWeight: 'bold', color: '#2563eb' }}>{eventoSeleccionado.data.estudiantes?.telefono || '--'}</span></div>
                                <div style={styles.rowInfo}><strong>Motivo:</strong> {eventoSeleccionado.data.titulo_cita}</div>
                            </div>
                        )}

                        {(eventoSeleccionado.tipo || eventoSeleccionado.type) === 'GLOBAL' && (
                            <div style={styles.cardInfo}><p style={{ margin: 0 }}>Evento visible para todos los tutores.</p></div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
                            {((eventoSeleccionado.tipo || eventoSeleccionado.type) === 'CITA' || ((eventoSeleccionado.tipo || eventoSeleccionado.type) === 'GLOBAL' && esAdmin)) && (
                                <button onClick={enviarWhatsApp} style={styles.btnWhatsapp}>
                                    {esAdmin && (eventoSeleccionado.tipo || eventoSeleccionado.type) === 'GLOBAL' ? '📢 Difundir' : '📲 Recordar'}
                                </button>
                            )}
                            {((!esAdmin && (eventoSeleccionado.tipo || eventoSeleccionado.type) === 'CITA') || (esAdmin && (eventoSeleccionado.tipo || eventoSeleccionado.type) === 'GLOBAL')) && (
                                <button onClick={eliminarItem} style={styles.btnDelete}>🗑️ Eliminar</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- AQUÍ ENVIAMOS LA FECHA AL MODAL --- */}
            {mostrarModalCita && (
                <ModalNuevaCita
                    estudiantes={estudiantes}
                    onClose={() => setMostrarModalCita(false)}
                    onGuardar={guardarCitaTutor}
                    fechaPreseleccionada={fechaSeleccionadaParaModal} // <--- NUEVA PROP
                />
            )}

            {modalAdminAbierto && (
                <div className="modal-overlay" style={styles.modalOverlay}>
                    <div style={styles.modalContent}>
                        <div style={styles.modalHeader}>
                            <h3 style={{ margin: 0, color: 'white', fontSize: '16px' }}>{eventoIdEdicion ? 'Editar' : 'Nuevo Evento'}</h3>
                            <button onClick={() => setModalAdminAbierto(false)} style={styles.closeBtn}>✕</button>
                        </div>
                        <div style={{ padding: '25px' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={styles.label}>Título</label>
                                <input type="text" value={nuevoEvento.title} onChange={(e) => setNuevoEvento({ ...nuevoEvento, title: e.target.value })} style={styles.input} autoFocus />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                                <div><label style={styles.label}>Inicio</label><input type="time" className="time-input" value={obtenerHoraString(nuevoEvento.start)} onChange={(e) => cambiarHora('start', e.target.value)} /></div>
                                <div><label style={styles.label}>Fin</label><input type="time" className="time-input" value={obtenerHoraString(nuevoEvento.end)} onChange={(e) => cambiarHora('end', e.target.value)} /></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'end', gap: '10px', marginTop: '25px' }}>
                                <button onClick={() => setModalAdminAbierto(false)} style={styles.btnCancel}>Cancelar</button>
                                <button onClick={guardarEventoAdmin} style={styles.btnSaveAdmin}>Guardar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ... estilos sin cambios ...
const styles = {
    legendBadge: (isAdmin) => ({ backgroundColor: isAdmin ? '#fef2f2' : '#eff6ff', color: isAdmin ? '#991b1b' : '#1e40af', border: `1px solid ${isAdmin ? '#fecaca' : '#bfdbfe'}`, padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }),
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' },
    modalContent: { backgroundColor: 'white', borderRadius: '16px', width: '400px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', border: '1px solid #e2e8f0' },
    modalHeader: { backgroundColor: '#0f172a', padding: '15px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    closeBtn: { background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' },
    label: { display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px', textTransform: 'uppercase' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '15px', boxSizing: 'border-box', outline: 'none', fontWeight: '500' },
    btnCancel: { padding: '10px 15px', backgroundColor: 'white', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' },
    btnDelete: { width: '100%', padding: '12px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    btnSaveAdmin: { padding: '10px 20px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' },
    btnWhatsapp: { width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#22c55e', color: 'white', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    drawer: { width: '340px', backgroundColor: 'white', borderRadius: '16px', boxShadow: '-5px 0 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease-out', marginLeft: '20px' },
    drawerHeader: { padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    drawerContent: { padding: '25px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
    cardInfo: { backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px', fontSize: '13px', color: '#334155' },
    rowInfo: { marginBottom: '8px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '4px' }
};

export default CalendarioAcademico;