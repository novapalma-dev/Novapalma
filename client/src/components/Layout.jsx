import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Truck, 
  Users, 
  MapPin, 
  LogOut, 
  LayoutDashboard, 
  UserCircle,
  DollarSign,
  Sun,
  Moon,
  Menu,
  X,
  Settings,
  ShieldCheck
} from 'lucide-react';

/**
 * ============================================================
 * LAYOUT PRINCIPAL RESPONSIVO (LAYOUT COMPONENT)
 * ============================================================
 * Estructura envolvente del sistema que integra el menú lateral (Sidebar),
 * la barra superior (Header) y el tema dinámico (Modo Oscuro/Claro).
 * Cuenta con optimizaciones de drawer colapsable para dispositivos móviles.
 */
const Layout = ({ children }) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  
  // Estado para controlar la visibilidad del Sidebar en pantallas móviles (Drawer)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Título contextual según la ruta activa
  const getHeaderMeta = () => {
    switch (location.pathname) {
      case '/':
        return { title: 'Centro de Control Logístico', subtitle: 'Monitoreo de báscula, tonelaje y flota' };
      case '/viajes':
        return { title: 'Despacho y Planillas de Viaje', subtitle: 'Control de tiquetes, pesaje y liquidación' };
      case '/conductores':
        return { title: 'Directorio de Conductores', subtitle: 'Personal operativo habilitado en ruta' };
      case '/vehiculos':
        return { title: 'Flota de Transporte', subtitle: 'Camiones, capacidades y disponibilidad' };
      case '/usuarios':
        return { title: 'Administración de Personal', subtitle: 'Control de accesos y roles RBAC' };
      case '/finanzas':
        return { title: 'Balance y Auditoría Financiera', subtitle: 'Consolidado contable de fletes y gastos' };
      case '/settings':
        return { title: 'Configuración del Sistema', subtitle: 'Parámetros por defecto y seguridad de cuenta' };
      default:
        return { title: 'Sistema Logístico Novapalma', subtitle: 'Operación Agroindustrial' };
    }
  };

  const headerMeta = getHeaderMeta();
  const userInitials = `${user?.primerNombre?.[0] || 'N'}${user?.primerApellido?.[0] || 'P'}`.toUpperCase();

  return (
    <div className="d-flex">
      {/* 
        Sidebar Lateral:
        En computadores es fijo. En celulares se desliza desde la izquierda (.open) 
      */}
      <div className={`sidebar d-flex flex-column ${isSidebarOpen ? 'open' : ''}`}>
        <div className="mb-4 pb-3 d-flex align-items-center justify-content-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="d-flex align-items-center gap-3">
            <div 
              className="d-flex align-items-center justify-content-center rounded-3 bg-white p-1 shadow-sm"
              style={{ width: '40px', height: '40px', flexShrink: 0 }}
            >
              <img 
                src="/logo.png" 
                alt="Novapalma" 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
              />
            </div>
            <div>
              <h4 className="m-0 fw-bold text-white brand-title" style={{ fontSize: '1.15rem', lineHeight: 1.1 }}>
                Novapalma
              </h4>
              <span className="d-block" style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 600, letterSpacing: '0.03em' }}>
                Logística Palmicultora
              </span>
            </div>
          </div>
          {/* Botón de cierre visible únicamente en móviles */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="btn btn-link text-white p-0 d-lg-none border-0"
            title="Cerrar menú"
          >
            <X size={22} />
          </button>
        </div>

        {/* Navegación Principal: Al hacer clic en móviles se cierra automáticamente */}
        <nav className="flex-grow-1">
          <div className="sidebar-section-label">Operación</div>
          <NavLink to="/" className="nav-link" onClick={() => setIsSidebarOpen(false)} end>
            <LayoutDashboard size={19} /> Dashboard
          </NavLink>
          <NavLink to="/viajes" className="nav-link" onClick={() => setIsSidebarOpen(false)}>
            <MapPin size={19} /> Viajes y Báscula
          </NavLink>
          <NavLink to="/conductores" className="nav-link" onClick={() => setIsSidebarOpen(false)}>
            <UserCircle size={19} /> Conductores
          </NavLink>
          <NavLink to="/vehiculos" className="nav-link" onClick={() => setIsSidebarOpen(false)}>
            <Truck size={19} /> Vehículos
          </NavLink>

          <div className="sidebar-section-label mt-2">Gestión y Control</div>
          {isAdmin() && (
            <>
              <NavLink to="/finanzas" className="nav-link" onClick={() => setIsSidebarOpen(false)}>
                <DollarSign size={19} /> Finanzas y Reportes
              </NavLink>
              <NavLink to="/usuarios" className="nav-link" onClick={() => setIsSidebarOpen(false)}>
                <Users size={19} /> Usuarios
              </NavLink>
            </>
          )}
          <NavLink to="/settings" className="nav-link" onClick={() => setIsSidebarOpen(false)}>
            <Settings size={19} /> Configuración
          </NavLink>
        </nav>

        <div className="mt-auto pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div 
            className="d-flex align-items-center gap-3 mb-2 p-2 rounded-3"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
          >
            <div 
              className="rounded-3 d-flex align-items-center justify-content-center fw-bold text-white"
              style={{ width: '36px', height: '36px', backgroundColor: '#0d6e47', fontSize: '0.8rem', flexShrink: 0 }}
            >
              {userInitials}
            </div>
            <div className="overflow-hidden flex-grow-1">
              <p className="m-0 small fw-semibold text-white text-truncate" style={{ lineHeight: 1.2 }}>
                {user?.primerNombre} {user?.primerApellido}
              </p>
              <span 
                className="d-inline-flex align-items-center gap-1 mt-1"
                style={{ fontSize: '10px', color: '#34d399', fontWeight: 700, letterSpacing: '0.04em' }}
              >
                <ShieldCheck size={11} /> {user?.rol}
              </span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="btn btn-link nav-link w-100 text-start border-0 bg-transparent text-danger py-2 px-3"
            style={{ fontSize: '0.85rem' }}
          >
            <LogOut size={18} /> Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Fondo protector táctil (Backdrop) que cierra el menú móvil al tocar fuera de él */}
      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Contenido Principal de la Aplicación */}
      <main className="flex-grow-1 p-3 p-lg-4 bg-light app-main overflow-auto vh-100">
        <header className="mb-4 pb-3 border-bottom d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            {/* Botón Hamburguesa móvil */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="btn btn-link p-0 text-primary d-lg-none me-3 border-0"
              title="Abrir menú"
            >
              <Menu size={26} />
            </button>
            <div>
              <h2 className="fw-bold m-0 text-dark page-title" style={{ fontSize: '1.35rem' }}>
                {headerMeta.title}
              </h2>
              <span className="text-muted d-none d-md-block" style={{ fontSize: '0.8rem' }}>
                {headerMeta.subtitle}
              </span>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button 
              onClick={toggleTheme} 
              className="theme-toggle-btn shadow-sm"
              title={theme === 'light' ? 'Activar Modo Oscuro' : 'Activar Modo Claro'}
              style={{ width: '38px', height: '38px' }}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} className="text-warning" />}
            </button>
            <div 
              className="bg-white px-3 py-1 rounded-pill shadow-sm small border d-none d-sm-flex align-items-center gap-2" 
              style={{ height: '38px', fontSize: '0.78rem' }}
            >
              <span className="status-dot"></span>
              <span className="text-muted">Estado:</span>
              <span className="text-success fw-bold">Conectado</span>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
};

export default Layout;
