import React, { useState, useEffect } from 'react';
import api from './api'; // Tu configuración de axios

const GestionPersonal = ({ user }) => {
  const [responsables, setResponsables] = useState([]);
  const [nuevoResp, setNuevoResp] = useState({ username: '', password: '', telefono: '' });

  // Cargar la lista de responsables de la escuela
  const cargarResponsables = async () => {
    try {
      const res = await api.get(`/admin/listar-responsables?escuela_id=${user.escuela_id}`);
      setResponsables(res.data);
    } catch (err) { console.error(err); }
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/registrar-responsable', nuevoResp);
      alert("Responsable creado correctamente");
      setNuevoResp({ username: '', password: '', telefono: '' });
      cargarResponsables();
    } catch (err) { alert("Error al crear responsable"); }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Gestión de Responsables de Tutoría</h2>
      <p className="mb-6 text-gray-600">Escuela: {user.escuela_nombre}</p>

      {/* Formulario */}
      <form onSubmit={handleCrear} className="bg-white p-4 rounded shadow mb-8 flex gap-4">
        <input type="text" placeholder="Usuario" className="border p-2 rounded" value={nuevoResp.username} onChange={e => setNuevoResp({...nuevoResp, username: e.target.value})} required />
        <input type="password" placeholder="Contraseña" className="border p-2 rounded" value={nuevoResp.password} onChange={e => setNuevoResp({...nuevoResp, password: e.target.value})} required />
        <input type="text" placeholder="Teléfono" className="border p-2 rounded" value={nuevoResp.telefono} onChange={e => setNuevoResp({...nuevoResp, telefono: e.target.value})} />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Registrar Nuevo Responsable</button>
      </form>

      {/* Tabla de Responsables */}
      <table className="w-full bg-white rounded shadow">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Usuario</th>
            <th className="p-2 text-left">Teléfono</th>
            <th className="p-2 text-left">Estado</th>
          </tr>
        </thead>
        <tbody>
          {responsables.map(r => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.username}</td>
              <td className="p-2">{r.telefono}</td>
              <td className="p-2"><span className="text-green-600 font-bold">ACTIVO</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GestionPersonal;