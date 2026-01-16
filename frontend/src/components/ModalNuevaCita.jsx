import React, { useState, useMemo, useEffect } from 'react';

export default function ModalNuevaCita({ estudiantes, onClose, onGuardar, fechaPreseleccionada }) {
  // --- ESTADOS DEL FORMULARIO ---
  const [estudianteId, setEstudianteId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [busqueda, setBusqueda] = useState(''); // Estado para el buscador rápido
  
  // Fecha actual local corregida para Andahuaylas/Perú (UTC-5)
  const obtenerFechaLocal = (fechaBase = new Date()) => {
    // Si viene una fecha del calendario (fechaBase), la usamos. Si no, usamos 'now'.
    const ahora = new Date(fechaBase);
    const fechaLocal = new Date(ahora.getTime() - (ahora.getTimezoneOffset() * 60000));
    return fechaLocal.toISOString().split('T')[0];
  };
  
  // CORRECCIÓN CLAVE: Usar la fechaPreseleccionada si existe
  const [fecha, setFecha] = useState(
      fechaPreseleccionada ? obtenerFechaLocal(fechaPreseleccionada) : obtenerFechaLocal()
  );
  
  const [hora, setHora] = useState('09:00');
  const [duracion, setDuracion] = useState(30);

  // --- LÓGICA DE FILTRADO DE ESTUDIANTES ---
  const estudiantesFiltrados = useMemo(() => {
    if (!busqueda) return estudiantes;
    return estudiantes.filter(est => 
      est.nombres_apellidos.toLowerCase().includes(busqueda.toLowerCase()) ||
      est.codigo_estudiante?.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [estudiantes, busqueda]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!estudianteId) {
      alert("⚠️ Por favor, seleccione un estudiante de la lista.");
      return;
    }
    
    // Enviamos los datos procesados al componente padre
    onGuardar({
      estudiante_id: estudianteId,
      titulo,
      fecha,
      hora,
      duracion
    });
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        
        {/* ENCABEZADO MODERNO CON GRADIENTE PROFESIONAL */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Programar Nueva Cita</h2>
            <p style={styles.subtitle}>Gestione su agenda de tutoría</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn} title="Cerrar">✕</button>
        </div>

        {/* CONTENIDO DEL FORMULARIO */}
        <form onSubmit={handleSubmit} style={styles.content}>
          
          {/* BUSCADOR Y SELECCIÓN DE ESTUDIANTE */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Seleccionar Estudiante</label>
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <input 
                type="text" 
                placeholder="🔍 Buscar por nombre o código..." 
                style={{ ...styles.input, backgroundColor: '#fff', borderStyle: 'dashed' }}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <select 
              style={styles.input}
              value={estudianteId}
              onChange={e => setEstudianteId(e.target.value)}
              required
              size={estudiantesFiltrados.length > 5 ? 5 : undefined} 
            >
              <option value="">-- Haga clic para seleccionar --</option>
              {estudiantesFiltrados.map(est => (
                <option key={est.id} value={est.id}>
                  {est.nombres_apellidos} {est.codigo_estudiante ? `(${est.codigo_estudiante})` : ''}
                </option>
              ))}
              {estudiantesFiltrados.length === 0 && (
                <option disabled>No se encontraron resultados</option>
              )}
            </select>
          </div>

          {/* TÍTULO O MOTIVO DE LA CITA CON DATALIST (MEJORA SENIOR) */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Título / Motivo de la Sesión</label>
            <input 
              type="text" 
              list="sugerencias-titulos"
              style={styles.input}
              value={titulo} 
              onChange={e => setTitulo(e.target.value)} 
              placeholder="Ej: Seguimiento F04" 
              required 
            />
            <datalist id="sugerencias-titulos">
              <option value="Seguimiento Individual F04" />
              <option value="Tutoría Grupal F02" />
              <option value="Entrevista de Diagnóstico F03" />
              <option value="Derivación Urgente F05" />
              <option value="Ficha Integral F01" />
            </datalist>
          </div>

          {/* FECHA Y HORA EN FILA */}
          <div style={styles.row}>
            <div style={{...styles.formGroup, flex: 1}}>
              <label style={styles.label}>Fecha Programada</label>
              <input 
                type="date" 
                style={styles.input}
                value={fecha} 
                onChange={e => setFecha(e.target.value)} 
                required 
              />
            </div>
            <div style={{...styles.formGroup, width: '130px'}}>
              <label style={styles.label}>Hora Inicio</label>
              <input 
                type="time" 
                style={styles.input}
                value={hora} 
                onChange={e => setHora(e.target.value)} 
                required 
              />
            </div>
          </div>

          {/* SELECTOR DE DURACIÓN TIPO PÍLDORA */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Duración Estimada de la Sesión</label>
            <div style={styles.radioGroup}>
              {[15, 30, 45, 60].map(min => (
                <div 
                  key={min} 
                  onClick={() => setDuracion(min)}
                  style={duracion === min ? styles.radioActive : styles.radio}
                >
                  {min >= 60 ? '1 hora' : `${min} min`}
                </div>
              ))}
            </div>
          </div>

          {/* ACCIONES DEL MODAL */}
          <div style={styles.footer}>
            <button type="button" onClick={onClose} style={styles.btnCancel}>
              Cancelar
            </button>
            <button type="submit" style={styles.btnSave}>
              Confirmar y Agendar
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// --- OBJETOS DE ESTILO MANTENIDOS ---
const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000
  },
  modal: {
    backgroundColor: 'white', width: '520px', maxWidth: '95%',
    borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    overflow: 'hidden', animation: 'fadeIn 0.2s ease-out', display: 'flex', flexDirection: 'column'
  },
  header: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  title: { margin: 0, fontSize: '18px', fontWeight: '700', letterSpacing: '-0.025em' },
  subtitle: { margin: '4px 0 0 0', fontSize: '13px', opacity: 0.8, fontWeight: '400' },
  closeBtn: {
    background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
    width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
    transition: 'background 0.2s'
  },
  content: { padding: '25px', display: 'flex', flexDirection: 'column', gap: '18px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: {
    padding: '11px 14px', borderRadius: '10px', border: '1px solid #e2e8f0',
    fontSize: '14px', color: '#1e293b', outline: 'none', transition: 'all 0.2s ease',
    backgroundColor: '#f8fafc', fontFamily: 'inherit'
  },
  row: { display: 'flex', gap: '15px' },
  
  radioGroup: { display: 'flex', gap: '10px' },
  radio: {
    flex: 1, padding: '10px 5px', textAlign: 'center', borderRadius: '10px',
    border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '13px',
    color: '#64748b', backgroundColor: 'white', transition: 'all 0.2s ease'
  },
  radioActive: {
    flex: 1, padding: '10px 5px', textAlign: 'center', borderRadius: '10px',
    border: '1px solid #3b82f6', cursor: 'pointer', fontSize: '13px',
    color: '#2563eb', backgroundColor: '#eff6ff', fontWeight: '700',
    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.1)'
  },

  footer: { display: 'flex', gap: '12px', marginTop: '10px', paddingBottom: '5px' },
  btnCancel: {
    flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0',
    backgroundColor: 'white', color: '#475569', fontWeight: '600', cursor: 'pointer',
    transition: 'background 0.2s'
  },
  btnSave: {
    flex: 2, padding: '12px', borderRadius: '10px', border: 'none',
    backgroundColor: '#004a99', color: 'white', fontWeight: '700', cursor: 'pointer',
    boxShadow: '0 4px 6px -1px rgba(0, 74, 153, 0.3)', transition: 'all 0.2s'
  }
};