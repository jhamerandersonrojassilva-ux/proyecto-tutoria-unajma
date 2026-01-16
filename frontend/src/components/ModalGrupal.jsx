import { useState, useRef } from 'react';

export default function ModalTutoriaGrupal({ estudiantes = [], onGuardar, onClose }) {
  const [tema, setTema] = useState('');
  const [area, setArea] = useState('Académica');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaCierre, setHoraCierre] = useState('');
  const [seleccionados, setSeleccionados] = useState([]);
  const [archivoEvidencia, setArchivoEvidencia] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const fileInputRef = useRef(null);

  const toggleEstudiante = (id) => {
    setSeleccionados(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArchivoEvidencia(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleGenerar = (e) => {
    e.preventDefault();
    if (seleccionados.length === 0) return alert("Marque al menos un asistente.");
    const asistentes = estudiantes.filter(est => seleccionados.includes(est.id));
    onGuardar({ 
      tema, area_tema: area, fecha, hora_inicio: horaInicio, hora_cierre: horaCierre,
      asistentes_ids: seleccionados, estudiantes_asistentes: asistentes,
      archivo_evidencia: archivoEvidencia, total_asignados: estudiantes.length,
      total_asistentes: seleccionados.length
    });
  };

  return (
    <div className="modal-overlay" style={overlayStyle}>
      <div className="modal-content" style={modalContentStyle}>
        <div style={headerStyle}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>TUTORÍA GRUPAL (F02)</h3>
          <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer'}}>✕</button>
        </div>
        <form onSubmit={handleGenerar}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Tema:</label>
              <input type="text" style={inputStyle} value={tema} onChange={e => setTema(e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Fecha:</label>
              <input type="date" style={inputStyle} value={fecha} onChange={e => setFecha(e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Área:</label>
              <select value={area} onChange={e => setArea(e.target.value)} style={inputStyle}>
                <option>Académica</option><option>Personal</option><option>Profesional</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: '15px', maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
            {estudiantes.map(est => (
              <div key={est.id} onClick={() => toggleEstudiante(est.id)} style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', backgroundColor: seleccionados.includes(est.id) ? '#f0fdf4' : 'white', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{fontSize: '13px'}}>{est.nombres_apellidos}</span>
                <input type="checkbox" checked={seleccionados.includes(est.id)} readOnly />
              </div>
            ))}
          </div>
          <div style={{ marginTop: '15px' }}>
            <label style={labelStyle}>Evidencia:</label>
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </div>
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}>Cancelar</button>
            <button type="submit" style={{ flex: 2, padding: '10px', borderRadius: '8px', backgroundColor: '#6f42c1', color: 'white', border: 'none', fontWeight: 'bold' }}>Guardar Asistencia</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 };
const modalContentStyle = { backgroundColor: 'white', padding: '25px', borderRadius: '15px', width: '500px' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' };
const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '5px', color: '#64748b' };
const inputStyle = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' };