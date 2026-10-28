import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogIn, ShieldAlert, ShieldCheck, Mail, Lock } from 'lucide-react';

const Login = () => {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const result = await login(correo, password);
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div 
      className="container-fluid vh-100 d-flex align-items-center justify-content-center p-3"
      style={{
        background: 'radial-gradient(circle at 50% 0%, rgba(13, 110, 71, 0.14) 0%, var(--bg-app) 65%)',
        backgroundColor: 'var(--bg-app)'
      }}
    >
      <div 
        className="card p-4 p-sm-5 shadow-lg border"
        style={{ 
          maxWidth: '420px', 
          width: '100%', 
          borderTop: '4px solid var(--primary)',
          borderRadius: '16px'
        }}
      >
        <div className="text-center mb-4">
          <div 
            className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-4 bg-white p-2 shadow-sm border"
            style={{ width: '110px', height: '110px' }}
          >
            <img 
              src="/logo.png" 
              alt="Novapalma Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
            />
          </div>
          <h4 className="fw-bold text-dark mb-1">Novapalma</h4>
          <p className="text-muted small m-0">Gestión Logística, Báscula y Control de Fletes</p>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 rounded-3 mb-3">
            <ShieldAlert size={18} className="flex-shrink-0" />
            <small className="fw-medium">{error}</small>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label text-secondary small fw-semibold d-flex align-items-center gap-1.5">
              <Mail size={14} className="text-primary" /> Correo Electrónico
            </label>
            <input
              type="email"
              className="form-control"
              placeholder="ejemplo@novapalma.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label className="form-label text-secondary small fw-semibold d-flex align-items-center gap-1.5">
              <Lock size={14} className="text-primary" /> Contraseña
            </label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary w-100 py-2.5 d-flex align-items-center justify-content-center gap-2"
            disabled={loading}
          >
            <LogIn size={18} />
            <span>{loading ? 'Validando credenciales...' : 'Entrar al Sistema'}</span>
          </button>
        </form>

        <div className="mt-4 pt-3 border-top text-center">
          <span className="text-muted d-inline-flex align-items-center gap-1" style={{ fontSize: '0.73rem' }}>
            <ShieldCheck size={14} className="text-success" />
            Auditoría Forense ACID · Pelaya, Cesar
          </span>
        </div>
      </div>
    </div>
  );
};

export default Login;
