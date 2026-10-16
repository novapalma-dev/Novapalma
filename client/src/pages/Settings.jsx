import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { 
  Settings as SettingsIcon, 
  Save, 
  Key, 
  Sliders, 
  User, 
  AlertCircle, 
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';

/**
 * ============================================================
 * VENTANA DE CONFIGURACIONES (SETTINGS PAGE)
 * ============================================================
 * Panel de control y personalización. Permite:
 * 1. Actualizar el perfil del usuario (nombre, apellido).
 * 2. Cambiar la contraseña de forma segura.
 * 3. Configurar valores por defecto del sistema para agilizar
 *    el registro de planillas en viajes (Precio por kg, ACPM, Ferry).
 * 4. Configurar preferencias visuales e interfaz de moneda.
 */
const Settings = () => {
  const { user, setUser, isAdmin } = useAuth();
  
  // Mensajes de éxito y error
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [systemSuccess, setSystemSuccess] = useState('');
  
  // Visibilidad de contraseñas
  const [showPassword, setShowPassword] = useState(false);

  // Estado para Datos de Perfil y Seguridad
  const [profileData, setProfileData] = useState({
    primerNombre: user?.primerNombre || '',
    primerApellido: user?.primerApellido || '',
    correo: user?.correo || '',
    rol: user?.rol || '',
    currentPassword: '',
    password: '',
    confirmPassword: ''
  });

  // Estado para Configuraciones del Sistema por Defecto
  const [systemData, setSystemData] = useState({
    defaultPriceKg: localStorage.getItem('defaultPriceKg') || '100',
    defaultAcpm: localStorage.getItem('defaultAcpm') || '0',
    defaultFerry: localStorage.getItem('defaultFerry') || '0',
    defaultOrigen: localStorage.getItem('defaultOrigen') || '',
    defaultDestino: localStorage.getItem('defaultDestino') || '',
    thousandSeparator: localStorage.getItem('thousandSeparator') || '.'
  });

  useEffect(() => {
    // Sincronizar datos si el usuario en el contexto cambia
    if (user) {
      setProfileData(prev => ({
        ...prev,
        primerNombre: user.primerNombre,
        primerApellido: user.primerApellido,
        correo: user.correo,
        rol: user.rol
      }));
    }
  }, [user]);

  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const { data } = await api.get('/configuracion');
        if (data) {
          setSystemData(prev => ({ ...prev, ...data }));
          localStorage.setItem('defaultPriceKg', data.defaultPriceKg ?? '100');
          localStorage.setItem('defaultAcpm', data.defaultAcpm ?? '0');
          localStorage.setItem('defaultFerry', data.defaultFerry ?? '0');
          localStorage.setItem('defaultOrigen', data.defaultOrigen ?? '');
          localStorage.setItem('defaultDestino', data.defaultDestino ?? '');
          localStorage.setItem('thousandSeparator', data.thousandSeparator ?? '.');
        }
      } catch (err) {
        console.error('Error al cargar configuración global:', err);
      }
    };
    fetchSystemSettings();
  }, []);

  // Manejar cambios en formulario de perfil
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  // Manejar cambios en formulario de sistema
  const handleSystemChange = (e) => {
    const { name, value } = e.target;
    setSystemData(prev => ({ ...prev, [name]: value }));
  };

  // Guardar Cambios de Perfil y Seguridad en Backend
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    // Validar contraseñas si el usuario intentó ingresar una
    if (profileData.password) {
      if (!profileData.currentPassword) {
        setProfileError('Debes ingresar tu contraseña actual para establecer una nueva contraseña.');
        return;
      }
      if (profileData.password.length < 8) {
        setProfileError('La contraseña debe tener al menos 8 caracteres.');
        return;
      }
      if (!/[0-9]/.test(profileData.password)) {
        setProfileError('La contraseña debe contener al menos un número.');
        return;
      }
      if (!/[^A-Za-z0-9]/.test(profileData.password)) {
        setProfileError('La contraseña debe contener al menos un carácter especial (ej. !@#$%^&*).');
        return;
      }
      if (profileData.password !== profileData.confirmPassword) {
        setProfileError('Las contraseñas no coinciden.');
        return;
      }
    }

    try {
      const payload = {
        primerNombre: profileData.primerNombre,
        primerApellido: profileData.primerApellido
      };

      if (profileData.password) {
        payload.currentPassword = profileData.currentPassword;
        payload.password = profileData.password;
      }

      // Consumir el endpoint PUT /api/auth/perfil
      const { data } = await api.put('/auth/perfil', payload);
      
      // Actualizar contexto y localStorage
      const updatedUser = { ...user, ...data.user };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      setProfileSuccess('¡Perfil y seguridad actualizados correctamente!');
      
      // Limpiar campos de contraseña
      setProfileData(prev => ({ ...prev, currentPassword: '', password: '', confirmPassword: '' }));
    } catch (err) {
      console.error('Error al actualizar el perfil:', err);
      setProfileError(err.response?.data?.error || 'No se pudo actualizar la información del perfil.');
    }
  };

  // Guardar Cambios de Configuraciones del Sistema en Base de Datos y LocalStorage
  const handleSystemSubmit = async (e) => {
    e.preventDefault();
    setSystemSuccess('');

    try {
      let savedSettings = systemData;
      if (isAdmin()) {
        const { data } = await api.put('/configuracion', systemData);
        savedSettings = { ...systemData, ...data };
        setSystemData(savedSettings);
      }

      // Guardar en LocalStorage para persistencia local de carga ágil
      localStorage.setItem('defaultPriceKg', savedSettings.defaultPriceKg);
      localStorage.setItem('defaultAcpm', savedSettings.defaultAcpm);
      localStorage.setItem('defaultFerry', savedSettings.defaultFerry);
      localStorage.setItem('defaultOrigen', savedSettings.defaultOrigen);
      localStorage.setItem('defaultDestino', savedSettings.defaultDestino);
      localStorage.setItem('thousandSeparator', savedSettings.thousandSeparator);

      setSystemSuccess('¡Valores del sistema y preferencias guardados correctamente!');
      window.dispatchEvent(new Event('storage'));

      setTimeout(() => {
        setSystemSuccess('');
      }, 4000);
    } catch (err) {
      console.error('Error al guardar configuración del sistema:', err);
    }
  };

  return (
    <div className="container-fluid">
      <div className="mb-4">
        <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
          <SettingsIcon className="text-primary" size={24} />
          Configuraciones
        </h4>
        <p className="text-muted small">Administra las credenciales de tu perfil, seguridad y preferencias del sistema logístico.</p>
      </div>

      <div className="row g-4">
        {/* PANEL 1: PERFIL Y SEGURIDAD */}
        <div className="col-12 col-xl-6">
          <div className="card shadow-sm border border-secondary-subtle h-100">
            <div className="card-header bg-white border-bottom border-secondary-subtle py-3">
              <h5 className="m-0 fw-bold d-flex align-items-center gap-2 text-primary">
                <User size={20} />
                Perfil y Seguridad
              </h5>
            </div>
            <div className="card-body py-4">
              {profileSuccess && (
                <div className="alert alert-success d-flex align-items-center gap-2 py-2 small" role="alert">
                  <CheckCircle size={18} className="flex-shrink-0" />
                  <div>{profileSuccess}</div>
                </div>
              )}
              {profileError && (
                <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small" role="alert">
                  <AlertCircle size={18} className="flex-shrink-0" />
                  <div>{profileError}</div>
                </div>
              )}

              <form onSubmit={handleProfileSubmit}>
                <div className="row g-3">
                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-semibold">Primer Nombre</label>
                    <input 
                      type="text"
                      name="primerNombre"
                      className="form-control form-control-sm"
                      value={profileData.primerNombre}
                      onChange={handleProfileChange}
                      required
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-semibold">Primer Apellido</label>
                    <input 
                      type="text"
                      name="primerApellido"
                      className="form-control form-control-sm"
                      value={profileData.primerApellido}
                      onChange={handleProfileChange}
                      required
                    />
                  </div>

                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-semibold">Correo Electrónico (No editable)</label>
                    <input 
                      type="email"
                      className="form-control form-control-sm bg-light"
                      value={profileData.correo}
                      disabled
                      readOnly
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-semibold">Rol Asignado</label>
                    <input 
                      type="text"
                      className="form-control form-control-sm bg-light text-uppercase fw-bold text-muted"
                      value={profileData.rol}
                      disabled
                      readOnly
                    />
                  </div>

                  <div className="border-top my-4 pt-3 border-secondary-subtle">
                    <h6 className="fw-bold mb-2 text-secondary">Cambiar Contraseña</h6>
                    <p className="text-muted small mb-3">Deja estos campos en blanco si no deseas cambiar tu contraseña actual.</p>
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold">Contraseña Actual</label>
                    <input 
                      type={showPassword ? "text" : "password"}
                      name="currentPassword"
                      className="form-control form-control-sm"
                      placeholder="Requerida solo si vas a cambiar tu contraseña"
                      value={profileData.currentPassword}
                      onChange={handleProfileChange}
                    />
                  </div>

                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-semibold">Nueva Contraseña</label>
                    <div className="input-group input-group-sm">
                      <input 
                        type={showPassword ? "text" : "password"}
                        name="password"
                        className="form-control"
                        placeholder="Mínimo 8 caracteres"
                        value={profileData.password}
                        onChange={handleProfileChange}
                      />
                      <button 
                        type="button" 
                        className="btn btn-outline-secondary" 
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-semibold">Confirmar Nueva Contraseña</label>
                    <input 
                      type={showPassword ? "text" : "password"}
                      name="confirmPassword"
                      className="form-control form-control-sm"
                      placeholder="Repite la contraseña"
                      value={profileData.confirmPassword}
                      onChange={handleProfileChange}
                    />
                  </div>

                  <div className="col-12 mt-4 pt-2">
                    <button type="submit" className="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 shadow-sm">
                      <Save size={16} />
                      Guardar Datos del Perfil
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* PANEL 2: PREFERENCIAS Y VALORES POR DEFECTO DEL SISTEMA */}
        <div className="col-12 col-xl-6">
          <div className="card shadow-sm border border-secondary-subtle h-100">
            <div className="card-header bg-white border-bottom border-secondary-subtle py-3">
              <h5 className="m-0 fw-bold d-flex align-items-center gap-2 text-primary">
                <Sliders size={20} />
                Preferencias y Valores por Defecto
              </h5>
            </div>
            <div className="card-body py-4">
              {systemSuccess && (
                <div className="alert alert-success d-flex align-items-center gap-2 py-2 small" role="alert">
                  <CheckCircle size={18} className="flex-shrink-0" />
                  <div>{systemSuccess}</div>
                </div>
              )}

              <form onSubmit={handleSystemSubmit}>
                <div className="row g-3">
                  <div className="col-12">
                    <h6 className="fw-bold mb-1 text-secondary">Visualización e Interfaz</h6>
                    <p className="text-muted small mb-3">Ajusta cómo se muestran los números y separadores de dinero.</p>
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold">Separador de Miles (Moneda)</label>
                    <select 
                      name="thousandSeparator"
                      className="form-select form-select-sm"
                      value={systemData.thousandSeparator}
                      onChange={handleSystemChange}
                    >
                      <option value=".">Puntos (Colombia): e.g. 450.000</option>
                      <option value=",">Comas (Estados Unidos): e.g. 450,000</option>
                    </select>
                  </div>

                  <div className="border-top my-4 pt-3 border-secondary-subtle w-100">
                    <h6 className="fw-bold mb-1 text-secondary">Valores de Llenado Rápido (Viajes)</h6>
                    <p className="text-muted small mb-3">
                      {isAdmin() 
                        ? 'Establece valores por defecto que se autocompletarán automáticamente en el formulario de Viajes para ahorrar tiempo de digitación.'
                        : 'Visualiza los valores por defecto configurados en la interfaz de operador (sólo administradores pueden editar estos parámetros).'
                      }
                    </p>
                  </div>

                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-semibold">Precio por Kilo de Fruto por defecto (COP/kg)</label>
                    <input 
                      type="number"
                      name="defaultPriceKg"
                      className="form-control form-control-sm"
                      value={systemData.defaultPriceKg}
                      onChange={handleSystemChange}
                      min="0"
                      disabled={!isAdmin()}
                      required
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-semibold">Costo de Combustible por defecto (ACPM)</label>
                    <input 
                      type="number"
                      name="defaultAcpm"
                      className="form-control form-control-sm"
                      value={systemData.defaultAcpm}
                      onChange={handleSystemChange}
                      min="0"
                      disabled={!isAdmin()}
                      required
                    />
                  </div>

                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-semibold">Costo de Ferry por defecto (COP)</label>
                    <input 
                      type="number"
                      name="defaultFerry"
                      className="form-control form-control-sm"
                      value={systemData.defaultFerry}
                      onChange={handleSystemChange}
                      min="0"
                      disabled={!isAdmin()}
                      required
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-semibold">Origen por defecto</label>
                    <input 
                      type="text"
                      name="defaultOrigen"
                      className="form-control form-control-sm"
                      placeholder="Ej. Planta Extractora"
                      value={systemData.defaultOrigen}
                      onChange={handleSystemChange}
                      disabled={!isAdmin()}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold">Destino por defecto</label>
                    <input 
                      type="text"
                      name="defaultDestino"
                      className="form-control form-control-sm"
                      placeholder="Ej. Puerto Novapalma"
                      value={systemData.defaultDestino}
                      onChange={handleSystemChange}
                      disabled={!isAdmin()}
                    />
                  </div>

                  <div className="col-12 mt-4 pt-2">
                    <button type="submit" className="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 shadow-sm">
                      <Save size={16} />
                      Guardar Preferencias del Sistema
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
