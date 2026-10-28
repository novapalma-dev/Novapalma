import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Search, Truck, Save, AlertCircle, Trash2, Edit, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Vehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { isAdmin } = useAuth();
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null
  });
  
  const [formData, setFormData] = useState({
    placa: '',
    marca: '',
    modelo: '',
    capacidad: '',
    estado: 'DISPONIBLE'
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateField = (name, value) => {
    let error = '';
    const strVal = String(value || '').trim();

    switch (name) {
      case 'placa':
        if (!strVal) {
          error = 'La placa es requerida';
        } else if (strVal.length !== 6) {
          error = 'La placa debe tener exactamente 6 caracteres';
        }
        break;
      case 'capacidad':
        if (!strVal) {
          error = 'La capacidad es requerida';
        } else {
          const capNum = parseFloat(strVal);
          if (isNaN(capNum) || capNum <= 0) {
            error = 'La capacidad debe ser un número mayor a 0';
          }
        }
        break;
      case 'marca':
        if (!strVal) {
          error = 'La marca es requerida';
        } else if (strVal.length < 2) {
          error = 'La marca debe tener al menos 2 caracteres';
        }
        break;
      case 'modelo':
        if (!strVal) {
          error = 'El modelo es requerido';
        } else if (strVal.length < 2) {
          error = 'El modelo debe tener al menos 2 caracteres';
        }
        break;
      default:
        break;
    }
    return error;
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/vehiculos?includeDeleted=true');
      setVehicles(data);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * MANEJADORES DE OPERACIONES DE LA FLOTA
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;
    
    // Sanitización en caliente de placa (remover no-alfanuméricos, forzar mayúsculas y máximo 6 caracteres)
    if (name === 'placa') {
      finalValue = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    } else if (name === 'capacidad') {
      // Sanitización en caliente de capacidad (solo números y un único punto decimal)
      let numericDecimal = value.replace(/[^0-9.]/g, '');
      const parts = numericDecimal.split('.');
      if (parts.length > 2) {
        numericDecimal = `${parts[0]}.${parts.slice(1).join('')}`;
      }
      finalValue = numericDecimal;
    } else if (name === 'marca' || name === 'modelo') {
      // Sanitización de marca y modelo (solo caracteres limpios)
      finalValue = value.replace(/[^a-zA-Z0-9\s.-]/g, '');
    }
    
    const newFormData = { ...formData, [name]: finalValue };
    setFormData(newFormData);

    // Si ya ha sido tocado, validar en caliente
    if (touched[name]) {
      const fieldError = validateField(name, finalValue);
      setErrors(prev => ({ ...prev, [name]: fieldError }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const fieldError = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: fieldError }));
  };

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setError('');
    setFormData({ placa: '', marca: '', modelo: '', capacidad: '', estado: 'DISPONIBLE' });
    setErrors({});
    setTouched({});
    setShowModal(true);
  };

  const handleEditClick = (vehicle) => {
    setIsEditing(true);
    setEditingId(vehicle.id);
    setError('');
    setFormData({
      placa: vehicle.placa,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      capacidad: vehicle.capacidad,
      estado: vehicle.estado
    });
    setErrors({});
    setTouched({});
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validar todos los campos antes de enviar
    const validationErrors = {};
    Object.keys(formData).forEach(key => {
      // No validamos estado porque es un select predeterminado
      if (key !== 'estado') {
        const err = validateField(key, formData[key]);
        if (err) validationErrors[key] = err;
      }
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Marcar todos como tocados para que se muestre el error visual
      const allTouched = {};
      Object.keys(formData).forEach(key => {
        allTouched[key] = true;
      });
      setTouched(allTouched);
      setError('Por favor, corrige los errores en el formulario antes de guardar.');
      return;
    }

    try {
      const payload = { ...formData, capacidad: parseFloat(formData.capacidad) };
      if (isEditing) {
        await api.put(`/vehiculos/${editingId}`, payload);
      } else {
        await api.post('/vehiculos', payload);
      }
      setShowModal(false);
      fetchVehicles();
      setFormData({ placa: '', marca: '', modelo: '', capacidad: '', estado: 'DISPONIBLE' });
      setIsEditing(false);
      setEditingId(null);
      setErrors({});
      setTouched({});
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar el vehículo');
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: 'Desactivar Vehículo',
      message: '¿Estás seguro de desactivar este vehículo?',
      onConfirm: async () => {
        try {
          await api.delete(`/vehiculos/${id}`);
          fetchVehicles();
        } catch (error) {
          alert(error.response?.data?.error || 'Error al eliminar');
        }
      }
    });
  };

  const handleRestore = async (id) => {
    try {
      await api.put(`/vehiculos/${id}`, { activo: true, deletedAt: null });
      fetchVehicles();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al reactivar el vehículo');
    }
  };


  const displayedVehicles = showInactive 
    ? vehicles 
    : vehicles.filter(v => v.activo);

  const totalPages = Math.ceil(displayedVehicles.length / pageSize) || 1;
  const paginatedVehicles = displayedVehicles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-1">Flota de Vehículos</h4>
          <p className="text-muted small">Administra los camiones y su estado operativo</p>
        </div>
        <div className="d-flex gap-3 align-items-center">
          {isAdmin() && (
            <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
              <input 
                type="checkbox" 
                className="form-check-input cursor-pointer" 
                id="showInactiveSwitch" 
                checked={showInactive} 
                onChange={(e) => {
                  setShowInactive(e.target.checked);
                  setCurrentPage(1);
                }} 
              />
              <label className="form-check-label small fw-bold text-secondary cursor-pointer" htmlFor="showInactiveSwitch">Mostrar Inactivos</label>
            </div>
          )}
          <button 
            className="btn btn-primary d-flex align-items-center gap-2 shadow-sm"
            onClick={handleOpenCreateModal}
          >
            <Plus size={20} /> Nuevo Vehículo
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th className="px-4 py-3 text-secondary small text-uppercase fw-bold">Placa</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Marca / Modelo</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Capacidad</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Estado</th>
                {isAdmin() && <th className="py-3 text-secondary small text-uppercase fw-bold text-end pe-4">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin() ? 5 : 4} className="text-center py-5">Cargando flota...</td></tr>
              ) : paginatedVehicles.length === 0 ? (
                <tr><td colSpan={isAdmin() ? 5 : 4} className="text-center py-5 text-muted">No se encontraron vehículos.</td></tr>
              ) : (
                paginatedVehicles.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4"><span className="plate-badge">{v.placa}</span></td>
                    <td><div className="fw-bold text-dark">{v.marca}</div><div className="text-muted small">{v.modelo}</div></td>
                    <td className="font-mono-num fw-medium">{v.capacidad} Ton</td>
                    <td>
                      <span className={`badge-status ${
                        !v.activo ? 'bg-danger-subtle text-danger' :
                        v.estado === 'DISPONIBLE' ? 'bg-success-subtle text-success' : 
                        v.estado === 'EN_VIAJE' ? 'bg-info-subtle text-info' : 'bg-warning-subtle text-warning-emphasis'
                      }`}>
                        {v.activo ? v.estado.replace('_', ' ') : 'INACTIVO'}
                      </span>
                    </td>
                    {isAdmin() && (
                      <td className="text-end pe-4">
                        <div className="d-inline-flex align-items-center gap-1">
                          <button className="action-icon-btn text-primary" onClick={() => handleEditClick(v)} title="Editar Vehículo">
                            <Edit size={17} />
                          </button>
                          {v.activo ? (
                            <button className="action-icon-btn text-danger" onClick={() => handleDelete(v.id)} title="Desactivar Vehículo">
                              <Trash2 size={17} />
                            </button>
                          ) : (
                            <button className="action-icon-btn text-success" onClick={() => handleRestore(v.id)} title="Reactivar Vehículo">
                              <RotateCcw size={17} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {displayedVehicles.length > pageSize && (
          <div className="card-footer bg-white border-0 py-3 px-4 d-flex justify-content-between align-items-center">
            <span className="small text-muted">
              Mostrando <strong>{(currentPage - 1) * pageSize + 1}</strong> a <strong>{Math.min(currentPage * pageSize, displayedVehicles.length)}</strong> de <strong>{displayedVehicles.length}</strong> vehículos
            </span>
            <div className="d-flex align-items-center gap-2">
              <button 
                type="button" 
                className="btn btn-sm btn-outline-secondary"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="small text-secondary px-2">Página {currentPage} de {totalPages}</span>
              <button 
                type="button" 
                className="btn btn-sm btn-outline-secondary"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <Truck size={20} /> 
                  {isEditing ? 'Editar Vehículo' : 'Registrar Vehículo'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4">
                  {error && <div className="alert alert-danger py-2 small">{error}</div>}
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Placa</label>
                      <input 
                        type="text" 
                        name="placa" 
                        className={`form-control ${touched.placa && errors.placa ? 'is-invalid' : ''}`} 
                        placeholder="ABC123" 
                        value={formData.placa} 
                        onChange={handleInputChange} 
                        onBlur={handleBlur} 
                      />
                      {touched.placa && errors.placa && (
                        <div className="invalid-feedback">{errors.placa}</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Capacidad (Ton)</label>
                      <input 
                        type="text" 
                        name="capacidad" 
                        className={`form-control ${touched.capacidad && errors.capacidad ? 'is-invalid' : ''}`} 
                        value={formData.capacidad} 
                        onChange={handleInputChange} 
                        onBlur={handleBlur} 
                      />
                      {touched.capacidad && errors.capacidad && (
                        <div className="invalid-feedback">{errors.capacidad}</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Marca</label>
                      <input 
                        type="text" 
                        name="marca" 
                        className={`form-control ${touched.marca && errors.marca ? 'is-invalid' : ''}`} 
                        value={formData.marca} 
                        onChange={handleInputChange} 
                        onBlur={handleBlur} 
                      />
                      {touched.marca && errors.marca && (
                        <div className="invalid-feedback">{errors.marca}</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Modelo</label>
                      <input 
                        type="text" 
                        name="modelo" 
                        className={`form-control ${touched.modelo && errors.modelo ? 'is-invalid' : ''}`} 
                        value={formData.modelo} 
                        onChange={handleInputChange} 
                        onBlur={handleBlur} 
                      />
                      {touched.modelo && errors.modelo && (
                        <div className="invalid-feedback">{errors.modelo}</div>
                      )}
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-bold">Estado Operativo</label>
                      <select
                        name="estado"
                        className="form-select"
                        value={formData.estado}
                        onChange={handleInputChange}
                      >
                        <option value="DISPONIBLE">DISPONIBLE</option>
                        <option value="EN_VIAJE">EN VIAJE</option>
                        <option value="MANTENIMIENTO">EN MANTENIMIENTO</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary d-flex align-items-center gap-2"><Save size={18} /> Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación */}
      {confirmModal.show && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '400px' }}>
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-dark">{confirmModal.title}</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                ></button>
              </div>
              <div className="modal-body py-3">
                <p className="text-secondary mb-0" style={{ fontSize: '0.95rem' }}>{confirmModal.message}</p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button 
                  type="button" 
                  className="btn btn-light fw-semibold" 
                  onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger fw-semibold" 
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal({ ...confirmModal, show: false });
                  }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vehicles;
