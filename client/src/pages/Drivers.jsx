import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, UserCircle, Save, Trash2, Phone, CreditCard, Edit, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Drivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const { isAdmin } = useAuth();
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null
  });
  
  const [formData, setFormData] = useState({
    cedula: '',
    primerNombre: '',
    segundoNombre: '',
    primerApellido: '',
    segundoApellido: '',
    telefono: ''
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateField = (name, value) => {
    let error = '';
    switch (name) {
      case 'cedula':
        if (!value) {
          error = 'La cédula es requerida';
        } else if (value.length < 6 || value.length > 20) {
          error = 'La cédula debe tener entre 6 y 20 dígitos';
        }
        break;
      case 'primerNombre':
        if (!value.trim()) {
          error = 'El primer nombre es requerido';
        } else if (value.trim().length < 2) {
          error = 'El nombre debe tener al menos 2 letras';
        }
        break;
      case 'primerApellido':
        if (!value.trim()) {
          error = 'El primer apellido es requerido';
        } else if (value.trim().length < 2) {
          error = 'El apellido debe tener al menos 2 letras';
        }
        break;
      case 'telefono':
        if (value && (value.length < 7 || value.length > 15)) {
          error = 'El teléfono debe tener entre 7 y 15 dígitos';
        }
        break;
      default:
        break;
    }
    return error;
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/conductores?includeDeleted=true');
      setDrivers(data);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;
    
    // Sanitización en caliente de cédula y teléfono (solo números)
    if (name === 'cedula' || name === 'telefono') {
      finalValue = value.replace(/\D/g, '');
    } else if (['primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido'].includes(name)) {
      // Sanitización en caliente de nombres (solo letras y espacios)
      finalValue = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
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
    setFormData({ cedula: '', primerNombre: '', segundoNombre: '', primerApellido: '', segundoApellido: '', telefono: '' });
    setErrors({});
    setTouched({});
    setShowModal(true);
  };

  const handleEditClick = (driver) => {
    setIsEditing(true);
    setEditingId(driver.id);
    setError('');
    setFormData({
      cedula: driver.cedula,
      primerNombre: driver.primerNombre,
      segundoNombre: driver.segundoNombre || '',
      primerApellido: driver.primerApellido,
      segundoApellido: driver.segundoApellido || '',
      telefono: driver.telefono || ''
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
      const err = validateField(key, formData[key]);
      if (err) validationErrors[key] = err;
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
      if (isEditing) {
        await api.put(`/conductores/${editingId}`, formData);
      } else {
        await api.post('/conductores', formData);
      }
      setShowModal(false);
      fetchDrivers();
      setFormData({ cedula: '', primerNombre: '', segundoNombre: '', primerApellido: '', segundoApellido: '', telefono: '' });
      setIsEditing(false);
      setEditingId(null);
      setErrors({});
      setTouched({});
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar el conductor');
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: 'Desactivar Conductor',
      message: '¿Estás seguro de desactivar este conductor?',
      onConfirm: async () => {
        try {
          await api.delete(`/conductores/${id}`);
          fetchDrivers();
        } catch (error) {
          alert(error.response?.data?.error || 'Error al eliminar');
        }
      }
    });
  };

  const handleRestore = async (id) => {
    try {
      await api.put(`/conductores/${id}`, { activo: true, deletedAt: null });
      fetchDrivers();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al reactivar el conductor');
    }
  };


  const displayedDrivers = showInactive 
    ? drivers 
    : drivers.filter(d => d.activo);

  const totalPages = Math.ceil(displayedDrivers.length / pageSize) || 1;
  const paginatedDrivers = displayedDrivers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-1">Cuerpo de Conductores</h4>
          <p className="text-muted small">Gestión de personal operativo y contacto</p>
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
            <Plus size={20} /> Nuevo Conductor
          </button>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-light">
              <tr>
                <th className="px-4 py-3 text-secondary small text-uppercase fw-bold">Cédula</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Nombre Completo</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Teléfono</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Estado</th>
                {isAdmin() && <th className="py-3 text-secondary small text-uppercase fw-bold text-end pe-4">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin() ? 5 : 4} className="text-center py-5">Cargando conductores...</td></tr>
              ) : paginatedDrivers.length === 0 ? (
                <tr><td colSpan={isAdmin() ? 5 : 4} className="text-center py-5 text-muted">No se encontraron conductores.</td></tr>
              ) : (
                paginatedDrivers.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 fw-bold text-primary">{d.cedula}</td>
                    <td>{d.primerNombre} {d.segundoNombre} {d.primerApellido} {d.segundoApellido}</td>
                    <td><Phone size={14} className="me-2 text-muted" /> {d.telefono || 'N/A'}</td>
                    <td>
                      <span className={`badge-status ${d.activo ? 'bg-success text-white' : 'bg-danger text-white'}`}>
                        {d.activo ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    {isAdmin() && (
                      <td className="text-end pe-4">
                        <button className="btn btn-link text-primary p-0 me-3" onClick={() => handleEditClick(d)} title="Editar Conductor">
                          <Edit size={18} />
                        </button>
                        {d.activo ? (
                          <button className="btn btn-link text-danger p-0" onClick={() => handleDelete(d.id)} title="Desactivar Conductor">
                            <Trash2 size={18} />
                          </button>
                        ) : (
                          <button className="btn btn-link text-success p-0" onClick={() => handleRestore(d.id)} title="Reactivar Conductor">
                            <RotateCcw size={18} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {displayedDrivers.length > pageSize && (
          <div className="card-footer bg-white border-0 py-3 px-4 d-flex justify-content-between align-items-center">
            <span className="small text-muted">
              Mostrando <strong>{(currentPage - 1) * pageSize + 1}</strong> a <strong>{Math.min(currentPage * pageSize, displayedDrivers.length)}</strong> de <strong>{displayedDrivers.length}</strong> conductores
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
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <UserCircle size={20} /> 
                  {isEditing ? 'Editar Conductor' : 'Registrar Conductor'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4">
                  {error && <div className="alert alert-danger py-2 small">{error}</div>}
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Cédula</label>
                      <input 
                        type="text" 
                        name="cedula" 
                        className={`form-control ${touched.cedula && errors.cedula ? 'is-invalid' : ''}`} 
                        value={formData.cedula} 
                        onChange={handleInputChange} 
                        onBlur={handleBlur} 
                      />
                      {touched.cedula && errors.cedula && (
                        <div className="invalid-feedback">{errors.cedula}</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Teléfono</label>
                      <input 
                        type="text" 
                        name="telefono" 
                        className={`form-control ${touched.telefono && errors.telefono ? 'is-invalid' : ''}`} 
                        value={formData.telefono} 
                        onChange={handleInputChange} 
                        onBlur={handleBlur} 
                      />
                      {touched.telefono && errors.telefono && (
                        <div className="invalid-feedback">{errors.telefono}</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Primer Nombre</label>
                      <input 
                        type="text" 
                        name="primerNombre" 
                        className={`form-control ${touched.primerNombre && errors.primerNombre ? 'is-invalid' : ''}`} 
                        value={formData.primerNombre} 
                        onChange={handleInputChange} 
                        onBlur={handleBlur} 
                      />
                      {touched.primerNombre && errors.primerNombre && (
                        <div className="invalid-feedback">{errors.primerNombre}</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Segundo Nombre</label>
                      <input 
                        type="text" 
                        name="segundoNombre" 
                        className={`form-control ${touched.segundoNombre && errors.segundoNombre ? 'is-invalid' : ''}`} 
                        value={formData.segundoNombre} 
                        onChange={handleInputChange} 
                        onBlur={handleBlur} 
                      />
                      {touched.segundoNombre && errors.segundoNombre && (
                        <div className="invalid-feedback">{errors.segundoNombre}</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Primer Apellido</label>
                      <input 
                        type="text" 
                        name="primerApellido" 
                        className={`form-control ${touched.primerApellido && errors.primerApellido ? 'is-invalid' : ''}`} 
                        value={formData.primerApellido} 
                        onChange={handleInputChange} 
                        onBlur={handleBlur} 
                      />
                      {touched.primerApellido && errors.primerApellido && (
                        <div className="invalid-feedback">{errors.primerApellido}</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Segundo Apellido</label>
                      <input 
                        type="text" 
                        name="segundoApellido" 
                        className={`form-control ${touched.segundoApellido && errors.segundoApellido ? 'is-invalid' : ''}`} 
                        value={formData.segundoApellido} 
                        onChange={handleInputChange} 
                        onBlur={handleBlur} 
                      />
                      {touched.segundoApellido && errors.segundoApellido && (
                        <div className="invalid-feedback">{errors.segundoApellido}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary d-flex align-items-center gap-2"><Save size={18} /> Guardar Conductor</button>
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

export default Drivers;
