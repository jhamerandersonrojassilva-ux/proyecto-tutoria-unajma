import React, { useState, useEffect } from "react";
import api from "../api/axios"; // Corregido: antes decía ../../api
import { toast } from "sonner"; // Corregido: estandarizado a sonner

const CicloManager = ({ onUpdate }) => {

  const [ciclos, setCiclos] = useState([]);
  const [nuevoNombre, setNuevoNombre] = useState('');

  useEffect(() => { cargarCiclos(); }, []);

  const cargarCiclos = async () => {
    const res = await api.get('/admin/ciclos');
    setCiclos(res.data);
  };

  const crearCiclo = async () => {
    if (!nuevoNombre) return;
    try {
      await api.post('/admin/ciclos', { nombre_ciclo: nuevoNombre });
      setNuevoNombre('');
      cargarCiclos();
      toast.success("Nuevo ciclo académico creado");
    } catch (e) { toast.error("Error al crear ciclo"); }
  };

  const activarCiclo = async (id) => {
    try {
      await api.patch(`/admin/ciclos/${id}/activar`);
      cargarCiclos();
      toast.success("Ciclo actual actualizado");
    } catch (e) { toast.error("Error al activar"); }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-600">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        📅 Configuración de Ciclo Académico
      </h2>
      
      <div className="flex gap-2 mb-6">
        <input 
          type="text" 
          placeholder="Ej: 2026-I" 
          className="border p-2 rounded flex-1 focus:ring-2 focus:ring-blue-400"
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
        />
        <button onClick={crearCiclo} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
          + Crear Ciclo
        </button>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Nombre del Ciclo</th>
            <th className="p-2 border">Estado</th>
            <th className="p-2 border">Acción</th>
          </tr>
        </thead>
        <tbody>
          {ciclos.map(c => (
            <tr key={c.id} className={c.activo ? "bg-green-50" : ""}>
              <td className="p-2 border font-medium">{c.nombre_ciclo}</td>
              <td className="p-2 border">
                {c.activo 
                  ? <span className="text-green-600 font-bold">● ACTIVO</span> 
                  : <span className="text-gray-400">Inactivo</span>
                }
              </td>
              <td className="p-2 border">
                {!c.activo && (
                  <button 
                    onClick={() => activarCiclo(c.id)}
                    className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-green-600 hover:text-white transition"
                  >
                    Activar para Tutorías
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CicloManager;