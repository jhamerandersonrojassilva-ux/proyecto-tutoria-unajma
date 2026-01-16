import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../api/axios';
import { toast } from 'sonner';

const BulkAsignacion = ({ tutores, cicloActivo }) => {
  // Estados de datos
  const [datosPendientes, setDatosPendientes] = useState([]); // Estudiantes cargados del Excel pero NO guardados
  const [seleccionados, setSeleccionados] = useState([]); // IDs (índices) de los checkbox marcados
  const [tutorDestino, setTutorDestino] = useState(""); // Tutor seleccionado en el dropdown
  const [archivoNombre, setArchivoNombre] = useState(null);
  const [cargando, setCargando] = useState(false);

  // --- 1. LEER EXCEL (SOLO CARGA EN MEMORIA) ---
  const manejarArchivo = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      
      // Mapeo inteligente
      const formateados = data.map((row, index) => {
        const keys = Object.keys(row);
        const getVal = (kBusqueda) => {
          const kReal = keys.find(k => k.toUpperCase().trim() === kBusqueda);
          return kReal ? row[kReal] : '';
        };
        
        return {
          id_temp: index, // ID temporal para el frontend
          dni: getVal('DNI'),
          nombres_apellidos: getVal('NOMBRES') || getVal('APELLIDOS Y NOMBRES') || getVal('NOMBRE'),
          codigo: getVal('CODIGO') || getVal('CÓDIGO'),
          escuela: getVal('ESCUELA') || 'Ingeniería de Sistemas'
        };
      }).filter(d => d.dni && d.nombres_apellidos);

      setDatosPendientes(formateados);
      setArchivoNombre(file.name);
      setSeleccionados([]); // Reiniciar selección
      toast.info(`📂 Se han cargado ${formateados.length} estudiantes en memoria. ¡Ahora asígnalos!`);
    };
    reader.readAsBinaryString(file);
  };

  // --- LOGICA DE CHECKBOX ---
  const toggleSeleccion = (id) => {
    if (seleccionados.includes(id)) {
      setSeleccionados(seleccionados.filter(s => s !== id));
    } else {
      setSeleccionados([...seleccionados, id]);
    }
  };

  const seleccionarTodos = () => {
    if (seleccionados.length === datosPendientes.length) {
      setSeleccionados([]); // Desmarcar todos
    } else {
      setSeleccionados(datosPendientes.map(d => d.id_temp)); // Marcar todos
    }
  };

  // --- 2. ASIGNACIÓN MANUAL ---
  const asignarManual = async () => {
    if (!tutorDestino) return toast.warning("⚠️ Selecciona un Tutor de la lista.");
    if (seleccionados.length === 0) return toast.warning("⚠️ Marca al menos un estudiante de la lista.");
    if (!cicloActivo) return toast.error("No hay ciclo activo.");

    // Filtramos los objetos completos de los seleccionados
    const grupoAEnviar = datosPendientes.filter(d => seleccionados.includes(d.id_temp));

    setCargando(true);
    try {
      await enviarAlBackend(grupoAEnviar, tutorDestino);
      
      // Si éxito: Quitamos los enviados de la lista de pendientes
      const restantes = datosPendientes.filter(d => !seleccionados.includes(d.id_temp));
      setDatosPendientes(restantes);
      setSeleccionados([]);
      toast.success(`✅ ${grupoAEnviar.length} estudiantes asignados correctamente.`);
    } catch (error) {
      toast.error("Error al asignar.");
    } finally {
      setCargando(false);
    }
  };

  // --- 3. ASIGNACIÓN ALEATORIA (DISTRIBUCIÓN) ---
  const distribuirAleatorio = async () => {
    if (datosPendientes.length === 0) return toast.warning("No hay estudiantes para repartir.");
    if (tutores.length === 0) return toast.warning("No hay tutores activos para recibir alumnos.");
    
    if (!window.confirm(`¿Repartir ${datosPendientes.length} estudiantes entre ${tutores.length} tutores aleatoriamente?`)) return;

    setCargando(true);
    try {
      // 1. Barajar estudiantes (Algoritmo Fisher-Yates)
      let mezclados = [...datosPendientes];
      for (let i = mezclados.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mezclados[i], mezclados[j]] = [mezclados[j], mezclados[i]];
      }

      // 2. Repartir
      const grupos = {};
      tutores.forEach((t, index) => {
        // Lógica de reparto circular
        grupos[t.id] = mezclados.filter((_, i) => i % tutores.length === index);
      });

      // 3. Enviar peticiones en paralelo
      const promesas = Object.keys(grupos).map(tutorId => {
        const alumnos = grupos[tutorId];
        if (alumnos.length > 0) {
          return enviarAlBackend(alumnos, tutorId);
        }
        return Promise.resolve();
      });

      await Promise.all(promesas);

      setDatosPendientes([]); // Limpiar todo porque ya se asignaron
      setSeleccionados([]);
      toast.success(`🎉 ¡Distribución completada! Se repartieron todos los alumnos.`);

    } catch (error) {
      console.error(error);
      toast.error("Ocurrió un error durante la distribución masiva.");
    } finally {
      setCargando(false);
    }
  };

  // Función auxiliar para conectar con tu API existente
  const enviarAlBackend = async (estudiantes, tutorId) => {
    const payload = {
      tutor_id: parseInt(tutorId),
      ciclo_id: parseInt(cicloActivo.id),
      estudiantes: estudiantes
    };
    await api.post('/admin/carga-masiva-estudiantes', payload);
  };

  return (
    <div style={styles.container}>
      {/* --- ENCABEZADO --- */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>📤 Mesa de Distribución de Carga</h2>
          <p style={styles.subtitle}>Sube la lista y reparte a los estudiantes (Manual o Automático)</p>
        </div>
        <div style={styles.cicloBadge}>
          Ciclo: <strong>{cicloActivo ? cicloActivo.nombre_ciclo : '---'}</strong>
        </div>
      </div>

      <div style={styles.grid}>
        
        {/* --- COLUMNA 1: CARGA Y ACCIONES --- */}
        <div style={styles.controlPanel}>
          
          {/* 1. CARGA */}
          <div style={styles.sectionBox}>
            <label style={styles.label}>1. Cargar Excel (Origen)</label>
            <input 
              id="fileInput" type="file" accept=".xlsx, .csv" 
              onChange={manejarArchivo} style={{display:'none'}} 
            />
            <label htmlFor="fileInput" style={styles.uploadBtn}>
              {archivoNombre ? `📄 ${archivoNombre}` : '📂 Seleccionar Archivo'}
            </label>
            <p style={{fontSize:'11px', color:'#64748b', marginTop:'5px'}}>Columnas: DNI, NOMBRES, CODIGO</p>
          </div>

          <div style={styles.divider}></div>

          {/* 2. ACCIONES */}
          <div style={{opacity: datosPendientes.length ? 1 : 0.5, pointerEvents: datosPendientes.length ? 'all' : 'none'}}>
            
            {/* MANUAL */}
            <div style={styles.sectionBox}>
              <label style={styles.label}>2. Asignación Manual</label>
              <div style={{marginBottom:'10px', fontSize:'12px', color:'#64748b'}}>
                Selecciona alumnos en la tabla, elige tutor y asigna.
              </div>
              <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                <select 
                  value={tutorDestino} onChange={e=>setTutorDestino(e.target.value)}
                  style={styles.select}
                >
                  <option value="">-- Elegir Tutor --</option>
                  {tutores.map(t => <option key={t.id} value={t.id}>{t.nombres_apellidos}</option>)}
                </select>
              </div>
              <button onClick={asignarManual} style={styles.btnManual} disabled={cargando}>
                {cargando ? 'Guardando...' : `👉 Asignar Seleccionados (${seleccionados.length})`}
              </button>
            </div>

            <div style={{textAlign:'center', margin:'15px 0', color:'#94a3b8', fontSize:'12px'}}>- O -</div>

            {/* AUTOMÁTICA */}
            <button onClick={distribuirAleatorio} style={styles.btnRandom} disabled={cargando}>
              🎲 Repartir RESTANTES Aleatoriamente
            </button>

          </div>
        </div>

        {/* --- COLUMNA 2: TABLA DE DATOS (STAGING AREA) --- */}
        <div style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <h3 style={{margin:0, fontSize:'16px'}}>
              📋 Lista de Estudiantes Pendientes ({datosPendientes.length})
            </h3>
            {datosPendientes.length > 0 && (
              <button onClick={() => setDatosPendientes([])} style={styles.btnClear}>Limpiar Lista</button>
            )}
          </div>
          
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.trHead}>
                  <th style={{...styles.th, width:'40px', textAlign:'center'}}>
                    <input 
                      type="checkbox" 
                      onChange={seleccionarTodos} 
                      checked={datosPendientes.length > 0 && seleccionados.length === datosPendientes.length}
                    />
                  </th>
                  <th style={styles.th}>Estudiante</th>
                  <th style={styles.th}>Código</th>
                  <th style={styles.th}>DNI</th>
                </tr>
              </thead>
              <tbody>
                {datosPendientes.length > 0 ? datosPendientes.map(d => (
                  <tr key={d.id_temp} style={seleccionados.includes(d.id_temp) ? styles.trSelected : styles.tr}>
                    <td style={{textAlign:'center', padding:'10px'}}>
                      <input 
                        type="checkbox" 
                        checked={seleccionados.includes(d.id_temp)}
                        onChange={() => toggleSeleccion(d.id_temp)}
                      />
                    </td>
                    <td style={styles.td}>
                      <div style={{fontWeight:'bold'}}>{d.nombres_apellidos}</div>
                    </td>
                    <td style={styles.td}>{d.codigo}</td>
                    <td style={styles.td}>{d.dni}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" style={{padding:'40px', textAlign:'center', color:'#94a3b8'}}>
                      <div style={{fontSize:'30px', marginBottom:'10px'}}>📥</div>
                      Sube un archivo Excel para comenzar la distribución.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

const styles = {
  container: { animation: 'fadeIn 0.3s' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' },
  title: { fontSize: '22px', fontWeight: 'bold', color: '#1e293b', margin: 0 },
  subtitle: { fontSize: '14px', color: '#64748b' },
  cicloBadge: { backgroundColor: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '20px', fontSize: '13px' },
  
  grid: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: '25px', alignItems: 'start' },
  
  // Panel Izquierdo
  controlPanel: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' },
  sectionBox: { marginBottom: '10px' },
  label: { display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' },
  divider: { height: '1px', backgroundColor: '#e2e8f0', margin: '20px 0' },
  
  uploadBtn: { display: 'block', width: '100%', padding: '10px', textAlign: 'center', border: '2px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer', color: '#3b82f6', fontWeight: '600', backgroundColor: '#f8fafc', transition: 'all 0.2s' },
  
  select: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '10px', fontSize: '14px' },
  
  btnManual: { width: '100%', backgroundColor: '#3b82f6', color: 'white', padding: '10px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' },
  btnRandom: { width: '100%', backgroundColor: '#8b5cf6', color: 'white', padding: '12px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.3)' },

  // Tabla Derecha
  tableCard: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'hidden', height: '600px', display: 'flex', flexDirection: 'column' },
  tableHeader: { padding: '15px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  btnClear: { border: 'none', background: 'none', color: '#ef4444', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' },
  
  tableWrapper: { flex: 1, overflowY: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  trHead: { backgroundColor: '#f1f5f9', position: 'sticky', top: 0, zIndex: 1 },
  th: { padding: '12px', textAlign: 'left', fontWeight: '600', color: '#475569', borderBottom: '2px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  trSelected: { borderBottom: '1px solid #bfdbfe', backgroundColor: '#eff6ff' },
  td: { padding: '10px', color: '#334155' }
};

export default BulkAsignacion;