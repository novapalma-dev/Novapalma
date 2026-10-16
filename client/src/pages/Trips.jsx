import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Save, AlertCircle, X, Edit, Trash2, Search, Info, CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Formateador de moneda estilo colombiano (separador de miles con punto)
const formatCurrencyCOP = (val) => {
  if (val === undefined || val === null || val === '') return '';
  const stringVal = val.toString().replace(/\D/g, '');
  if (!stringVal) return '';
  return Number(stringVal).toLocaleString('de-DE');
};

const getInitialFormData = () => ({
  ticket: '',
  fecha: new Date().toISOString().split('T')[0],
  origen: localStorage.getItem('defaultOrigen') || '',
  destino: localStorage.getItem('defaultDestino') || '',
  empresa: '',
  producto: 'FRUTO',
  tonelaje: '',   // Ingresado en KILOGRAMOS en la UI, guardado en TONELADAS en la BD
  valorPago: '',  // Manual para COMPOST
  precioKg: localStorage.getItem('defaultPriceKg') || '100',   // Pago por KILOGRAMO para FRUTO
  driverId: '',
  vehicleId: '',
  consumoAcpm: 0,
  usoAcpm: false,
  usoFerry: false,
  porcentajeConductor: 1.00,
  valorAcpm: localStorage.getItem('defaultAcpm') || '0',
  valorFerry: localStorage.getItem('defaultFerry') || '0'
});

const Trips = ({ isDashboard = false }) => {
  const { isAdmin } = useAuth();
  const [trips, setTrips] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: isDashboard ? 8 : 15,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(isDashboard ? 8 : 15);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Estado del formulario
  const [formData, setFormData] = useState(getInitialFormData());

  // Debounce para búsqueda reactiva en servidor
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // 1. Cargar catálogos auxiliares (conductores, vehículos, configuración) una sola vez
  useEffect(() => {
    fetchAuxiliaryData();
  }, []);

  const fetchAuxiliaryData = async () => {
    try {
      const [driversRes, vehiclesRes, configRes] = await Promise.all([
        api.get('/conductores'),
        api.get('/vehiculos'),
        api.get('/configuracion').catch(() => ({ data: null }))
      ]);
      if (configRes?.data) {
        const cfg = configRes.data;
        localStorage.setItem('defaultPriceKg', cfg.defaultPriceKg ?? '100');
        localStorage.setItem('defaultAcpm', cfg.defaultAcpm ?? '0');
        localStorage.setItem('defaultFerry', cfg.defaultFerry ?? '0');
        localStorage.setItem('defaultOrigen', cfg.defaultOrigen ?? '');
        localStorage.setItem('defaultDestino', cfg.defaultDestino ?? '');
        localStorage.setItem('thousandSeparator', cfg.thousandSeparator ?? '.');
      }
      setDrivers(driversRes.data);
      setVehicles(vehiclesRes.data);
    } catch (error) {
      console.error('Error fetching auxiliary data:', error);
    }
  };

  // 2. Cargar viajes paginados cada vez que cambie página, tamaño o búsqueda
  useEffect(() => {
    fetchTrips();
  }, [currentPage, pageSize, debouncedSearch]);

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString()
      });
      if (debouncedSearch.trim()) {
        queryParams.set('search', debouncedSearch.trim());
      }
      const res = await api.get(`/viajes?${queryParams.toString()}`);
      if (res.data?.pagination) {
        setTrips(res.data.data);
        setPagination(res.data.pagination);
      } else {
        setTrips(Array.isArray(res.data) ? res.data : []);
      }
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * ============================================================
   * CONTROLADORES DE INTERFAZ Y BLINDAJES DE SEGURIDAD (UX)
   * ============================================================
   */

  /**
   * Manejador genérico de cambios en inputs con sanitización activa.
   * RF-Viajes-01: Evita caracteres especiales, signos negativos o pegado malicioso.
   */
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'usoFerry') {
      setFormData({
        ...formData,
        usoFerry: checked,
        valorFerry: checked ? formData.valorFerry : ''
      });
      return;
    }

    if (name === 'usoAcpm') {
      setFormData({
        ...formData,
        usoAcpm: checked,
        valorAcpm: checked ? formData.valorAcpm : '',
        consumoAcpm: checked ? formData.consumoAcpm : '0'
      });
      return;
    }

    if (name === 'ticket') {
      // Sanitización estricta de ticket: remueve cualquier carácter no numérico (\D).
      // Impide físicamente guiones, signos +, letras o espacios en vivo.
      const positiveInteger = value.replace(/\D/g, '');
      setFormData({
        ...formData,
        ticket: positiveInteger
      });
      return;
    }
    
    if (
      name === 'tonelaje' || 
      name === 'consumoAcpm' || 
      name === 'porcentajeConductor'
    ) {
      // Sanitización para entradas numéricas decimales o enteras (kg, galones, porcentaje)
      let cleanedValue = value.replace(/-/g, '');
      if (cleanedValue !== '' && parseFloat(cleanedValue) < 0) {
        cleanedValue = '0';
      }
      if (name === 'porcentajeConductor' && cleanedValue !== '' && parseFloat(cleanedValue) > 100) {
        cleanedValue = '100';
      }
      
      setFormData({
        ...formData,
        [name]: cleanedValue
      });
      return;
    }

    if (
      name === 'valorPago' || 
      name === 'precioKg' || 
      name === 'valorAcpm' || 
      name === 'valorFerry'
    ) {
      // Sanitización para valores monetarios (solo dígitos enteros)
      const digitsOnly = value.replace(/\D/g, '');
      setFormData({
        ...formData,
        [name]: digitsOnly
      });
      return;
    }

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  /**
   * Bloqueador de teclado físico en inputs numéricos.
   * Bloquea signos negativos, positivos y notación científica 'e' / 'E'
   * para prevenir que se rompa el esquema de la base de datos o Zod.
   */
  const handleKeyDownPositive = (e) => {
    if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
      e.preventDefault();
    }
  };

  /**
   * OBTENCIÓN DEL VALOR PAGO PACTADO (AUTOMÁTICO O MANUAL)
   * Para FRUTO se calcula dinámicamente multiplicando Tons * 1000 * precioKg.
   * Para COMPOST se ingresa de forma manual.
   */
  const getCalculatedPayment = () => {
    if (formData.producto === 'FRUTO') {
      const kg = parseFloat(formData.tonelaje) || 0;
      const priceKg = parseFloat(formData.precioKg) || 0;
      // Cálculo directo: Kilogramos * Precio por Kg
      return Math.round(kg * priceKg);
    }
    return parseFloat(formData.valorPago) || 0;
  };

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setError('');
    setFormData(getInitialFormData());
    setShowModal(true);
  };

  const handleEditClick = (trip) => {
    setIsEditing(true);
    setEditingId(trip.id);
    setError('');
    
    // UI almacena en kilogramos, BD en toneladas (tons * 1000)
    const tons = Number(trip.tonelaje) || 0;
    const kg = Math.round(tons * 1000);
    
    // Obtener precio por kilo para pre-poblar
    let calculatedPriceKg = '100';
    if (trip.producto === 'FRUTO' && kg > 0) {
      calculatedPriceKg = Math.round(Number(trip.valorPago) / kg).toString();
    }

    setFormData({
      ticket: trip.ticket.toString(),
      fecha: new Date(trip.fecha).toISOString().split('T')[0],
      origen: trip.origen,
      destino: trip.destino || '',
      empresa: trip.empresa || '',
      producto: trip.producto,
      tonelaje: kg.toString(),
      valorPago: Math.round(parseFloat(trip.valorPago) || 0).toString(),
      precioKg: calculatedPriceKg,
      driverId: trip.driverId,
      vehicleId: trip.vehicleId,
      consumoAcpm: trip.consumoAcpm ? trip.consumoAcpm.toString() : '0',
      usoAcpm: trip.usoAcpm || false,
      usoFerry: trip.usoFerry || false,
      porcentajeConductor: trip.porcentajeConductor ? trip.porcentajeConductor.toString() : '1.00',
      valorAcpm: trip.valorAcpm ? Math.round(parseFloat(trip.valorAcpm) || 0).toString() : '0',
      valorFerry: trip.valorFerry ? Math.round(parseFloat(trip.valorFerry) || 0).toString() : '0'
    });
    
    setShowModal(true);
  };

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: 'Eliminar Planilla de Viaje',
      message: '¿Estás seguro de eliminar esta planilla de viaje? Esta acción es irreversible.',
      onConfirm: async () => {
        try {
          await api.delete(`/viajes/${id}`);
          fetchTrips();
        } catch (err) {
          alert(err.response?.data?.error || 'Error al eliminar el viaje');
        }
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const payload = {
        ticket: parseInt(formData.ticket, 10),
        fecha: formData.fecha,
        origen: formData.origen,
        destino: formData.destino || null,
        empresa: formData.empresa || null,
        producto: formData.producto,
        tonelaje: parseFloat(formData.tonelaje) / 1000,
        consumoAcpm: parseFloat(formData.consumoAcpm) || 0,
        usoAcpm: formData.usoAcpm,
        usoFerry: formData.usoFerry,
        porcentajeConductor: parseFloat(formData.porcentajeConductor) || 1.00,
        valorAcpm: parseFloat(formData.valorAcpm) || 0,
        valorFerry: parseFloat(formData.valorFerry) || 0,
        driverId: formData.driverId,
        vehicleId: formData.vehicleId,
      };

      payload.valorPago = getCalculatedPayment();
      
      if (isEditing) {
        await api.put(`/viajes/${editingId}`, payload);
      } else {
        await api.post('/viajes', payload);
      }
      
      setShowModal(false);
      fetchTrips();
      setIsEditing(false);
      setEditingId(null);
      setFormData(getInitialFormData());
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar el viaje');
    }
  };

  const displayedTrips = trips;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-1">Registro de Despachos (Viajes)</h4>
          <p className="text-muted small">Visualiza e ingresa las planillas de los conductores registradas al final del periodo.</p>
        </div>
        <div className="d-flex gap-3 align-items-center">
          <div className="input-group" style={{ width: '260px' }}>
            <span className="input-group-text bg-light border-0"><Search size={18} className="text-muted" /></span>
            <input 
              type="text" 
              className="form-control bg-light border-0 ps-0" 
              placeholder="Buscar por Ticket..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* HIDE nuevo viaje button if integrated in the general Dashboard */}
          {!isDashboard && (
            <button 
              className="btn btn-primary d-flex align-items-center gap-2 shadow-sm"
              onClick={handleOpenCreateModal}
            >
              <Plus size={20} /> Nuevo Viaje
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Viajes */}
      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-light">
              <tr>
                <th className="px-4 py-3 text-secondary small text-uppercase fw-bold">Ticket</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Fecha</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Vehículo</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Ruta (Origen &rarr; Destino)</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Empresa</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Producto</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Tonelaje</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Valor Flete</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Conductor</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Pago Cond.</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Gastos</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Margen Neto</th>
                {isAdmin() && <th className="py-3 text-secondary small text-uppercase fw-bold text-end pe-4">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin() ? 13 : 12} className="text-center py-5">
                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                    Cargando viajes registrados...
                  </td>
                </tr>
              ) : displayedTrips.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin() ? 13 : 12} className="text-center py-5 text-muted">
                    {pagination.total === 0 ? 'No se encontraron registros de viajes.' : 'Ningún registro coincide con tu búsqueda.'}
                  </td>
                </tr>
              ) : (
                displayedTrips.map((trip) => {
                  const driverVal = Number(trip.valorConductor || 0);
                  const acpmVal = trip.usoAcpm ? Number(trip.valorAcpm || 0) : 0;
                  const ferryVal = trip.usoFerry ? Number(trip.valorFerry || 0) : 0;
                  const totalExpenses = driverVal + acpmVal + ferryVal;
                  const netUtility = Number(trip.valorPago) - totalExpenses;

                  return (
                    <tr 
                      key={trip.id} 
                      onClick={() => setSelectedTrip(trip)} 
                      style={{ cursor: 'pointer' }}
                      className="align-middle"
                    >
                      <td className="px-4 fw-bold text-primary">#{trip.ticket}</td>
                      <td>{new Date(trip.fecha).toLocaleDateString(undefined, { timeZone: 'UTC' })}</td>
                      <td><span className="badge bg-light text-dark border">{trip.vehicle?.placa}</span></td>
                      <td className="small fw-medium">
                        {trip.origen} 
                        {trip.destino ? <span className="text-secondary"> &rarr; {trip.destino}</span> : ''}
                      </td>
                      <td className="text-muted small">{trip.empresa || 'N/A'}</td>
                      <td>
                        <span className={`badge px-2 py-1 rounded-pill ${trip.producto === 'FRUTO' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning-emphasis'}`}>
                          {trip.producto}
                        </span>
                      </td>
                      <td className="small">{trip.tonelaje} Ton</td>
                      <td className="fw-bold text-dark small">${Number(trip.valorPago).toLocaleString()}</td>
                      <td className="small">{trip.driver?.primerNombre} {trip.driver?.primerApellido}</td>
                      <td className="text-success small fw-semibold">
                        ${driverVal.toLocaleString()} <small className="text-muted">({Number(trip.porcentajeConductor || 1.0)}%)</small>
                      </td>
                      <td className="text-danger small">${totalExpenses.toLocaleString()}</td>
                      <td className={`fw-bold small ${netUtility >= 0 ? 'text-success' : 'text-danger'}`}>
                        ${netUtility.toLocaleString()}
                      </td>
                      {isAdmin() && (
                        <td className="text-end pe-4">
                          <button 
                            className="btn btn-link text-primary p-0 me-3" 
                            onClick={(e) => { e.stopPropagation(); handleEditClick(trip); }} 
                            title="Editar Viaje"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            className="btn btn-link text-danger p-0" 
                            onClick={(e) => { e.stopPropagation(); handleDelete(trip.id); }} 
                            title="Eliminar Viaje"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Barra de Paginación Avanzada y Responsiva */}
        <div className="card-footer bg-white border-0 py-3 px-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div className="d-flex align-items-center gap-3">
            <span className="small text-muted">
              Mostrando <strong className="text-dark">{trips.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}</strong> a <strong className="text-dark">{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> de <strong className="text-dark">{pagination.total}</strong> viajes
            </span>
            <div className="d-flex align-items-center gap-1">
              <span className="small text-muted me-1">Por pág:</span>
              <select 
                className="form-select form-select-sm bg-light border-0" 
                style={{ width: '70px' }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={8}>8</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button 
              type="button"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center p-1 px-2"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage(1)}
              title="Primera página"
            >
              <ChevronsLeft size={16} />
            </button>
            <button 
              type="button"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 px-2"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              title="Página anterior"
            >
              <ChevronLeft size={16} /> Anterior
            </button>

            <span className="small fw-semibold px-2 text-secondary">
              Página {pagination.page} de {pagination.totalPages || 1}
            </span>

            <button 
              type="button"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 px-2"
              disabled={currentPage >= pagination.totalPages || loading}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.totalPages))}
              title="Página siguiente"
            >
              Siguiente <ChevronRight size={16} />
            </button>
            <button 
              type="button"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center p-1 px-2"
              disabled={currentPage >= pagination.totalPages || loading}
              onClick={() => setCurrentPage(pagination.totalPages)}
              title="Última página"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Creación */}
      {showModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  {isEditing ? <Edit size={20} /> : <Plus size={20} />} 
                  {isEditing ? 'Editar Planilla de Viaje' : 'Registrar Nueva Planilla de Viaje'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4">
                  {error && (
                    <div className="alert alert-danger d-flex align-items-center gap-2">
                      <AlertCircle size={20} /> {error}
                    </div>
                  )}
                  
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Número de Ticket *</label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        name="ticket" 
                        className="form-control" 
                        placeholder="Ej: 14529" 
                        value={formData.ticket} 
                        onChange={handleInputChange} 
                        required 
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Fecha de Operación *</label>
                      <input 
                        type="date" 
                        name="fecha" 
                        className="form-control" 
                        max={new Date().toISOString().split('T')[0]}
                        value={formData.fecha} 
                        onChange={handleInputChange} 
                        required 
                      />
                    </div>

                    {/* RUTA (ORIGEN Y DESTINO SEPARADOS) */}
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Origen / Punto de Carga *</label>
                      <input 
                        type="text" 
                        name="origen" 
                        className="form-control" 
                        placeholder="Ej: Extractora-Gloria" 
                        value={formData.origen} 
                        onChange={handleInputChange} 
                        required 
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Destino / Punto de Descarga *</label>
                      <input 
                        type="text" 
                        name="destino" 
                        className="form-control" 
                        placeholder="Ej: Hacienda-Gloria" 
                        value={formData.destino} 
                        onChange={handleInputChange} 
                        required 
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Empresa / Cliente</label>
                      <input 
                        type="text" 
                        name="empresa" 
                        className="form-control" 
                        placeholder="Ej: EXTRACTORA - GLORIA" 
                        value={formData.empresa} 
                        onChange={handleInputChange} 
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Porcentaje Conductor (%) *</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0"
                        max="100"
                        onKeyDown={handleKeyDownPositive}
                        name="porcentajeConductor" 
                        className="form-control" 
                        placeholder="Ej: 1.00" 
                        value={formData.porcentajeConductor} 
                        onChange={handleInputChange} 
                        required 
                      />
                    </div>
                    
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Conductor Responsable *</label>
                      <select name="driverId" className="form-select" value={formData.driverId} onChange={handleInputChange} required>
                        <option value="">Seleccione Conductor...</option>
                        {drivers.map(d => (
                          <option key={d.id} value={d.id}>{d.primerNombre} {d.primerApellido} ({d.cedula})</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Vehículo Asignado *</label>
                      <select name="vehicleId" className="form-select" value={formData.vehicleId} onChange={handleInputChange} required>
                        <option value="">Seleccione Vehículo...</option>
                        {vehicles.map(v => (
                          <option
                            key={v.id}
                            value={v.id}
                            disabled={v.estado === 'MANTENIMIENTO' && formData.vehicleId !== v.id}
                          >
                            {v.placa} - {v.marca} ({v.capacidad} Ton){v.estado === 'MANTENIMIENTO' ? ' [EN MANTENIMIENTO]' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-12">
                      <label className="form-label small fw-bold">Producto Transportado *</label>
                      <select name="producto" className="form-select" value={formData.producto} onChange={handleInputChange} required>
                        <option value="FRUTO">FRUTO (Fruta de Palma)</option>
                        <option value="COMPOST">COMPOST (Abono orgánico)</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-bold">Kilogramos Reales (kg) *</label>
                      <input 
                        type="number" 
                        step="1" 
                        min="1"
                        max="60000"
                        onKeyDown={handleKeyDownPositive}
                        name="tonelaje" 
                        className="form-control fw-bold" 
                        placeholder="Ej: 8540" 
                        value={formData.tonelaje} 
                        onChange={handleInputChange} 
                        required 
                      />
                      {(() => {
                        if (!formData.tonelaje || !formData.vehicleId) return null;
                        const selectedVeh = vehicles.find(v => v.id === formData.vehicleId);
                        if (!selectedVeh) return null;
                        const weightInTons = parseFloat(formData.tonelaje) / 1000;
                        if (weightInTons > parseFloat(selectedVeh.capacidad)) {
                          return (
                            <div className="text-warning small mt-1 fw-bold d-flex align-items-center gap-1" style={{ fontSize: '0.7rem', lineHeight: '1.1' }}>
                              <AlertCircle size={12} className="flex-shrink-0" /> Excede {selectedVeh.capacidad} Ton cap.
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="col-md-3 d-flex align-items-center pt-4">
                      <div className="form-check form-switch">
                        <input 
                          type="checkbox" 
                          name="usoAcpm" 
                          className="form-check-input" 
                          id="usoAcpmSwitch" 
                          checked={formData.usoAcpm} 
                          onChange={handleInputChange} 
                        />
                        <label className="form-check-label small fw-bold" htmlFor="usoAcpmSwitch">¿Usa ACPM?</label>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-bold">Consumo ACPM (Gal.)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        min="0"
                        onKeyDown={handleKeyDownPositive}
                        name="consumoAcpm" 
                        className="form-control" 
                        placeholder={formData.usoAcpm ? "Ej: 15.0" : "Bloqueado"} 
                        value={formData.consumoAcpm} 
                        onChange={handleInputChange} 
                        disabled={!formData.usoAcpm}
                      />
                    </div>
                    <div className="col-md-3 d-flex align-items-center pt-4">
                      <div className="form-check form-switch">
                        <input 
                          type="checkbox" 
                          name="usoFerry" 
                          className="form-check-input" 
                          id="usoFerrySwitch" 
                          checked={formData.usoFerry} 
                          onChange={handleInputChange} 
                        />
                        <label className="form-check-label small fw-bold" htmlFor="usoFerrySwitch">¿Usa Ferry?</label>
                      </div>
                    </div>

                    {/* COSTOS FINANCIEROS REALES */}
                    <div className="col-md-6">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <label className="form-label small fw-bold m-0">Costo ACPM Real (COP)</label>
                        <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-0.5 small cursor-pointer" onClick={() => formData.usoAcpm && setFormData(prev => ({ ...prev, valorAcpm: localStorage.getItem('defaultAcpm') || '0' }))} title="Haga clic para aplicar el valor configurado por defecto" style={{ cursor: formData.usoAcpm ? 'pointer' : 'not-allowed', opacity: formData.usoAcpm ? 1 : 0.5, fontSize: '0.75rem' }}>
                          Defecto: ${formatCurrencyCOP(localStorage.getItem('defaultAcpm') || '0')}
                        </span>
                      </div>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input 
                          type="text" 
                          name="valorAcpm" 
                          className="form-control text-end fw-semibold" 
                          placeholder={formData.usoAcpm ? "Ej: 349.291" : "Bloqueado"} 
                          value={formatCurrencyCOP(formData.valorAcpm)} 
                          onChange={handleInputChange} 
                          disabled={!formData.usoAcpm}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <label className="form-label small fw-bold m-0">Costo Ferry Real (COP)</label>
                        <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-0.5 small cursor-pointer" onClick={() => formData.usoFerry && setFormData(prev => ({ ...prev, valorFerry: localStorage.getItem('defaultFerry') || '0' }))} title="Haga clic para aplicar el valor configurado por defecto" style={{ cursor: formData.usoFerry ? 'pointer' : 'not-allowed', opacity: formData.usoFerry ? 1 : 0.5, fontSize: '0.75rem' }}>
                          Defecto: ${formatCurrencyCOP(localStorage.getItem('defaultFerry') || '0')}
                        </span>
                      </div>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input 
                          type="text" 
                          name="valorFerry" 
                          className="form-control text-end fw-semibold" 
                          placeholder={formData.usoFerry ? "Ej: 220.000" : "Bloqueado (Active Ferry)"} 
                          value={formatCurrencyCOP(formData.valorFerry)} 
                          onChange={handleInputChange} 
                          disabled={!formData.usoFerry}
                        />
                      </div>
                    </div>

                    {/* DYNAMIC PRICE & MARGIN PREVIEW SECTION */}
                    <div className="col-12 mt-4 p-3 bg-light rounded border border-light-subtle">
                      <div className="row g-3">
                        <div className="col-md-6">
                          <div>
                            {formData.producto === 'FRUTO' ? (
                              <>
                                <span className="badge bg-success mb-1">CÁLCULO AUTOMÁTICO (KG &rarr; PRECIO KILO)</span>
                                <h6 className="m-0 fw-bold mb-1">Precio por Kilogramo (Fruta)</h6>
                                <p className="text-muted small mb-2">Ingrese el valor pactado por kilo. El sistema calculará el flete y mostrará la equivalencia corporativa.</p>
                                <div className="mt-2">
                                  <div className="d-flex justify-content-between align-items-center mb-2">
                                    <label className="form-label small fw-bold text-success m-0">Precio por Kg de Fruta (COP) *</label>
                                    <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-0.5 small cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, precioKg: localStorage.getItem('defaultPriceKg') || '100' }))} title="Haga clic para aplicar el valor configurado por defecto" style={{ cursor: 'pointer', fontSize: '0.75rem' }}>
                                      Defecto: ${formatCurrencyCOP(localStorage.getItem('defaultPriceKg') || '100')}
                                    </span>
                                  </div>
                                  <div className="input-group mb-2">
                                    <span className="input-group-text bg-success text-white">$</span>
                                    <input 
                                      type="text" 
                                      name="precioKg" 
                                      className="form-control fw-bold text-end" 
                                      placeholder="Ej: 130" 
                                      value={formatCurrencyCOP(formData.precioKg)} 
                                      onChange={handleInputChange} 
                                      required={formData.producto === 'FRUTO'}
                                    />
                                    <span className="input-group-text bg-light text-muted">/ kg</span>
                                  </div>

                                  <div className="bg-white p-2 rounded border border-light-subtle small mt-2">
                                    <div className="d-flex justify-content-between mb-1">
                                      <span className="text-muted">Cantidad a facturar:</span>
                                      <span className="fw-semibold text-dark">
                                        {Number(formData.tonelaje || 0).toLocaleString()} kg ({((parseFloat(formData.tonelaje) || 0) / 1000).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} Tons)
                                      </span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-1">
                                      <span className="text-muted">Precio por Kilogramo:</span>
                                      <span className="fw-semibold text-dark">
                                        ${formatCurrencyCOP(formData.precioKg)} COP / kg
                                      </span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-1 text-secondary">
                                      <span className="small">Equivalente por Tonelada:</span>
                                      <span className="small fw-semibold">
                                        ${formatCurrencyCOP(Number(formData.precioKg || 0) * 1000)} COP / Ton
                                      </span>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                                      <span className="text-muted fw-bold">Valor de Flete Total:</span>
                                      <span className="badge bg-success-subtle text-success fw-bold fs-6">
                                        ${Number(getCalculatedPayment()).toLocaleString()} COP
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="badge bg-primary mb-1">PRECIO MANUAL ESTIPULADO</span>
                                <h6 className="m-0 fw-bold mb-1">Valor de Flete Pactado</h6>
                                <p className="text-muted small mb-2">Las tarifas se calculan de forma manual y se ingresan directamente al sistema.</p>
                                <div className="mt-2">
                                  <label className="form-label small fw-bold text-primary">Costo Flete Pactado (COP) *</label>
                                  <div className="input-group">
                                    <span className="input-group-text">$</span>
                                    <input 
                                      type="text" 
                                      name="valorPago" 
                                      className="form-control fw-bold text-end" 
                                      placeholder="Ej: 450.000" 
                                      value={formatCurrencyCOP(formData.valorPago)} 
                                      onChange={handleInputChange} 
                                      required={formData.producto === 'COMPOST'}
                                    />
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* LIVE RENTABILITY PREVIEWER */}
                        <div className="col-md-6 border-start ps-4">
                          <h6 className="fw-bold mb-2 text-secondary small text-uppercase">Previsualización de Rentabilidad</h6>
                          
                          <div className="d-flex justify-content-between mb-1 small">
                            <span className="text-muted">Ingreso Flete:</span>
                            <span className="fw-semibold text-dark">${Number(getCalculatedPayment()).toLocaleString()}</span>
                          </div>
                          
                          <div className="d-flex justify-content-between mb-1 small">
                            <span className="text-muted">Pago Conductor ({formData.porcentajeConductor || 1}%):</span>
                            <span className="text-danger fw-semibold">-${Number(getCalculatedPayment() * (parseFloat(formData.porcentajeConductor || 1) / 100)).toLocaleString()}</span>
                          </div>
                          
                          <div className="d-flex justify-content-between mb-1 small">
                            <span className="text-muted">Gasto ACPM (COP):</span>
                            <span className="text-danger fw-semibold">-${Number(formData.valorAcpm || 0).toLocaleString()}</span>
                          </div>
                          
                          <div className="d-flex justify-content-between mb-2 small">
                            <span className="text-muted">Gasto Ferry (COP):</span>
                            <span className="text-danger fw-semibold">-${Number(formData.valorFerry || 0).toLocaleString()}</span>
                          </div>
                          
                          <hr className="my-2" />
                          
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="fw-bold text-secondary">Margen Neto (Utilidad):</span>
                            <span className={`fw-bold fs-5 ${getCalculatedPayment() - (getCalculatedPayment() * (parseFloat(formData.porcentajeConductor || 1) / 100) + parseFloat(formData.valorAcpm || 0) + parseFloat(formData.valorFerry || 0)) >= 0 ? 'text-success' : 'text-danger'}`}>
                              ${Number(getCalculatedPayment() - (getCalculatedPayment() * (parseFloat(formData.porcentajeConductor || 1) / 100) + parseFloat(formData.valorAcpm || 0) + parseFloat(formData.valorFerry || 0))).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary d-flex align-items-center gap-2">
                    <Save size={18} /> Guardar Planilla
                  </button>
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

      {/* Sidebar de Detalles del Viaje (Drawer) */}
      {selectedTrip && (
        <>
          <div 
            className="details-drawer-overlay animate__animated animate__fadeIn" 
            onClick={() => setSelectedTrip(null)}
          ></div>
          <div className="details-drawer open p-4">
            <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
              <div>
                <span className="badge bg-primary-subtle text-primary mb-1">AUDITORÍA DE DESPACHO</span>
                <h4 className="fw-bold m-0 text-dark">Ticket #{selectedTrip.ticket}</h4>
              </div>
              <button 
                className="btn btn-light rounded-circle p-2 border-0" 
                onClick={() => setSelectedTrip(null)}
                style={{ width: '40px', height: '40px' }}
              >
                <X size={20} className="text-secondary" />
              </button>
            </div>

            <div className="flex-grow-1 overflow-auto pe-1" style={{ fontSize: '0.9rem' }}>
              {/* Sección: Información General */}
              <div className="card bg-light border-0 p-3 mb-3">
                <h6 className="fw-bold mb-2 text-secondary text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>Detalles de Operación</h6>
                <div className="row g-2">
                  <div className="col-6">
                    <span className="text-muted small d-block">Fecha</span>
                    <span className="fw-medium text-dark">{new Date(selectedTrip.fecha).toLocaleDateString(undefined, { timeZone: 'UTC' })}</span>
                  </div>
                  <div className="col-6">
                    <span className="text-muted small d-block">Producto</span>
                    <span className={`badge px-2 py-0.5 rounded-pill ${selectedTrip.producto === 'FRUTO' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning-emphasis'}`}>{selectedTrip.producto}</span>
                  </div>
                  <div className="col-12 mt-2">
                    <span className="text-muted small d-block">Ruta</span>
                    <span className="fw-semibold text-dark">{selectedTrip.origen} {selectedTrip.destino ? ` ➔ ${selectedTrip.destino}` : ''}</span>
                  </div>
                  <div className="col-12 mt-2">
                    <span className="text-muted small d-block">Empresa Cliente</span>
                    <span className="fw-medium text-dark">{selectedTrip.empresa || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Sección: Flota */}
              <div className="card border-light-subtle p-3 mb-3 shadow-sm bg-white">
                <h6 className="fw-bold mb-2 text-secondary text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>Asignación de Logística</h6>
                <div className="d-flex align-items-center gap-3 mb-3 pb-2 border-bottom">
                  <div className="bg-primary-subtle text-primary rounded p-2 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }}>
                    <Info size={20} />
                  </div>
                  <div>
                    <span className="text-muted small d-block">Vehículo</span>
                    <span className="fw-bold text-dark">{selectedTrip.vehicle?.placa}</span>
                    <span className="text-secondary small d-block">{selectedTrip.vehicle?.marca} ({selectedTrip.vehicle?.capacidad} Ton cap.)</span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <div className="bg-success-subtle text-success rounded p-2 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }}>
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="text-muted small d-block">Conductor</span>
                    <span className="fw-bold text-dark">{selectedTrip.driver?.primerNombre} {selectedTrip.driver?.primerApellido}</span>
                    <span className="text-secondary small d-block">C.C. {selectedTrip.driver?.cedula}</span>
                  </div>
                </div>
              </div>

              {/* Sección: Carga y Financiero */}
              <div className="card border-light-subtle p-3 mb-3 shadow-sm bg-white">
                <h6 className="fw-bold mb-3 text-secondary text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>Carga & Balance Económico</h6>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-muted">Tonelaje Total:</span>
                  <span className="fw-semibold text-dark">{selectedTrip.tonelaje} Ton <small className="text-muted">({Number(selectedTrip.tonelaje) * 1000} Kg)</small></span>
                </div>
                <div className="d-flex justify-content-between align-items-center p-2 rounded mb-3 bg-success-subtle text-success">
                  <span className="fw-bold small">FLETE (Ingreso Bruto):</span>
                  <span className="fw-bold fs-5">${Number(selectedTrip.valorPago).toLocaleString()}</span>
                </div>

                <div className="border-top pt-2">
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted small">Gastos de Conductor ({selectedTrip.porcentajeConductor}%):</span>
                    <span className="text-danger fw-semibold small">-${Number(selectedTrip.valorConductor).toLocaleString()}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted small">Costo Combustible ACPM {selectedTrip.consumoAcpm ? `(${selectedTrip.consumoAcpm} Gal.)` : ''}:</span>
                    <span className="text-danger fw-semibold small">-${Number(selectedTrip.valorAcpm || 0).toLocaleString()}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-3">
                    <span className="text-muted small">Costo Cruce de Ferry:</span>
                    <span className="text-danger fw-semibold small">-${Number(selectedTrip.valorFerry || 0).toLocaleString()}</span>
                  </div>
                  
                  {/* Total de Gastos */}
                  {(() => {
                    const totalExpenses = Number(selectedTrip.valorConductor || 0) + Number(selectedTrip.valorAcpm || 0) + Number(selectedTrip.valorFerry || 0);
                    const netUtility = Number(selectedTrip.valorPago) - totalExpenses;
                    return (
                      <>
                        <div className="d-flex justify-content-between py-2 border-top border-bottom mb-3 fw-bold small text-secondary">
                          <span>TOTAL EGRESOS OPERATIVOS:</span>
                          <span className="text-danger">-${totalExpenses.toLocaleString()}</span>
                        </div>
                        <div className="d-flex justify-content-between align-items-center p-3 rounded" style={{ backgroundColor: netUtility >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)' }}>
                          <span className="fw-bold" style={{ color: netUtility >= 0 ? '#10b981' : '#ef4444', fontSize: '0.8rem' }}>UTILIDAD OPERATIVA NETO:</span>
                          <span className="fw-bold fs-5" style={{ color: netUtility >= 0 ? '#10b981' : '#ef4444' }}>${netUtility.toLocaleString()}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            
            <div className="pt-3 border-top text-center text-muted" style={{ fontSize: '0.75rem' }}>
              Registrado por: {selectedTrip.registradoPor?.primerNombre || 'Sistema'} {selectedTrip.registradoPor?.primerApellido || ''}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Trips;
