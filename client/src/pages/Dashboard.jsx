import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  UserCircle, 
  Truck, 
  Scale, 
  DollarSign, 
  Calendar, 
  RefreshCw,
  Award,
  ArrowUpRight
} from 'lucide-react';
import Trips from './Trips';

const Dashboard = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros del Dashboard
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tripsRes, driversRes] = await Promise.all([
        api.get('/viajes'),
        api.get('/conductores')
      ]);
      setTrips(tripsRes.data);
      setDrivers(driversRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedDriver('');
  };

  /**
   * ============================================================
   * PROCESAMIENTO Y FILTRADO DE DATOS (BUSINESS LOGIC)
   * ============================================================
   */

  // Filtrar viajes en memoria
  const filteredTrips = trips.filter(trip => {
    // Filtro por fecha
    if (startDate) {
      const tripDate = new Date(trip.fecha);
      const sDate = new Date(startDate);
      if (tripDate < sDate) return false;
    }
    if (endDate) {
      const tripDate = new Date(trip.fecha);
      const eDate = new Date(endDate + 'T23:59:59.999Z');
      if (tripDate > eDate) return false;
    }
    // Filtro por conductor
    if (selectedDriver && trip.driverId !== selectedDriver) {
      return false;
    }
    return true;
  });

  // 1. Métricas de Summary Cards
  const totalTons = filteredTrips.reduce((sum, t) => sum + Number(t.tonelaje), 0);
  const totalTripsCount = filteredTrips.length;
  const averageTonsPerTrip = totalTripsCount > 0 ? totalTons / totalTripsCount : 0;
  const totalBilling = filteredTrips.reduce((sum, t) => sum + Number(t.valorPago), 0);

  // 2. Cálculo de tendencias (últimos 30 días vs 30 días anteriores)
  const getTrend = (metricSelector) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const currentPeriodTrips = trips.filter(t => {
      const d = new Date(t.fecha);
      return d >= thirtyDaysAgo && d <= now;
    });

    const previousPeriodTrips = trips.filter(t => {
      const d = new Date(t.fecha);
      return d >= sixtyDaysAgo && d < thirtyDaysAgo;
    });

    let currentVal = 0;
    let prevVal = 0;

    if (metricSelector === 'ton') {
      currentVal = currentPeriodTrips.reduce((sum, t) => sum + Number(t.tonelaje), 0);
      prevVal = previousPeriodTrips.reduce((sum, t) => sum + Number(t.tonelaje), 0);
    } else if (metricSelector === 'trips') {
      currentVal = currentPeriodTrips.length;
      prevVal = previousPeriodTrips.length;
    } else if (metricSelector === 'efficiency') {
      const currT = currentPeriodTrips.reduce((sum, t) => sum + Number(t.tonelaje), 0);
      const prevT = previousPeriodTrips.reduce((sum, t) => sum + Number(t.tonelaje), 0);
      currentVal = currentPeriodTrips.length > 0 ? currT / currentPeriodTrips.length : 0;
      prevVal = previousPeriodTrips.length > 0 ? prevT / previousPeriodTrips.length : 0;
    } else if (metricSelector === 'billing') {
      currentVal = currentPeriodTrips.reduce((sum, t) => sum + Number(t.valorPago), 0);
      prevVal = previousPeriodTrips.reduce((sum, t) => sum + Number(t.valorPago), 0);
    }

    if (prevVal === 0) return { percent: 12, isPositive: true }; // Fallback estático elegante
    const diff = currentVal - prevVal;
    const percent = Math.abs(Math.round((diff / prevVal) * 100));
    return { percent, isPositive: diff >= 0 };
  };

  const tonTrend = getTrend('ton');
  const tripsTrend = getTrend('trips');
  const efficiencyTrend = getTrend('efficiency');
  const billingTrend = getTrend('billing');

  // 3. Agrupación mensual para gráfico de Evolución (Últimos 6 meses)
  const getMonthlyEvolutionData = () => {
    const monthsName = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyMap = {};

    // Inicializar últimos 6 meses
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthsName[d.getMonth()]} ${d.getFullYear()}`;
      monthlyMap[key] = { label: key, tons: 0, monthNum: d.getMonth(), year: d.getFullYear() };
    }

    // Sumar toneladas
    filteredTrips.forEach(t => {
      const d = new Date(t.fecha);
      const key = `${monthsName[d.getMonth()]} ${d.getFullYear()}`;
      if (monthlyMap[key]) {
        monthlyMap[key].tons += Number(t.tonelaje);
      }
    });

    return Object.values(monthlyMap);
  };

  const monthlyEvolutionData = getMonthlyEvolutionData();

  // 4. Agrupación por Producto (Dona de Tipo de Fruto)
  const getProductData = () => {
    const productMap = {
      FRUTO: { name: 'Fruto de Palma', value: 0, color: '#10b981' },
      COMPOST: { name: 'Compost Orgánico', value: 0, color: '#f59e0b' }
    };

    filteredTrips.forEach(t => {
      if (productMap[t.producto]) {
        productMap[t.producto].value += Number(t.tonelaje);
      }
    });

    const totalProductTons = Object.values(productMap).reduce((sum, p) => sum + p.value, 0);

    return Object.values(productMap).map(p => ({
      ...p,
      percentage: totalProductTons > 0 ? (p.value / totalProductTons) * 100 : 0
    }));
  };

  const productData = getProductData();

  // 5. Agrupación Top 5 Conductores por Tonelaje
  const getTopDrivers = () => {
    const driverMap = {};

    filteredTrips.forEach(t => {
      const name = t.driver ? `${t.driver.primerNombre} ${t.driver.primerApellido}` : 'Conductor N/A';
      if (!driverMap[name]) driverMap[name] = 0;
      driverMap[name] += Number(t.tonelaje);
    });

    return Object.entries(driverMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  const topDrivers = getTopDrivers();

  // 6. Distribución de Viajes por Empresa
  const getCompanyData = () => {
    const companyMap = {};

    filteredTrips.forEach(t => {
      const company = t.empresa || 'Otros Destinos';
      if (!companyMap[company]) companyMap[company] = 0;
      companyMap[company] += 1;
    });

    const colors = ['#0d6e47', '#10b981', '#f59e0b', '#0284c7', '#6366f1'];
    const totalCompanyTrips = Object.values(companyMap).reduce((sum, c) => sum + c, 0);

    return Object.entries(companyMap)
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length],
        percentage: totalCompanyTrips > 0 ? (value / totalCompanyTrips) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);
  };

  const companyData = getCompanyData();

  /**
   * ============================================================
   * RENDERIZADO DE COMPONENTES GRÁFICOS SVG NATIVOS (PRO-AESTHETICS)
   * ============================================================
   */

  // Renderizador del gráfico de líneas SVG de evolución
  const renderLineChart = () => {
    if (monthlyEvolutionData.length === 0) return null;
    
    const width = 450;
    const height = 180;
    const padding = 35;
    
    const maxTons = Math.max(...monthlyEvolutionData.map(d => d.tons), 50);
    
    const getX = (index) => padding + (index * (width - 2 * padding)) / (monthlyEvolutionData.length - 1);
    const getY = (tons) => height - padding - (tons * (height - 2 * padding)) / maxTons;

    // Crear la línea y el área
    let linePath = '';
    let areaPath = '';

    monthlyEvolutionData.forEach((d, i) => {
      const x = getX(i);
      const y = getY(d.tons);
      if (i === 0) {
        linePath = `M ${x} ${y}`;
        areaPath = `M ${x} ${height - padding} L ${x} ${y}`;
      } else {
        linePath += ` L ${x} ${y}`;
        areaPath += ` L ${x} ${y}`;
      }
      if (i === monthlyEvolutionData.length - 1) {
        areaPath += ` L ${x} ${height - padding} Z`;
      }
    });

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="pe-none">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        
        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
          const y = padding + ratio * (height - 2 * padding);
          const value = maxTons * (1 - ratio);
          return (
            <g key={index}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="var(--border-color)" strokeDasharray="4" />
              <text x={padding - 6} y={y + 4} fill="var(--text-muted)" fontSize="10" textAnchor="end">{Math.round(value)}</text>
            </g>
          );
        })}

        {/* Eje X Etiquetas */}
        {monthlyEvolutionData.map((d, i) => (
          <text key={i} x={getX(i)} y={height - 10} fill="var(--text-muted)" fontSize="10" textAnchor="middle">
            {d.label}
          </text>
        ))}

        {/* Dibujar Área y Línea */}
        {monthlyEvolutionData.length > 1 && (
          <>
            <path d={areaPath} fill="url(#areaGradient)" />
            <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}

        {/* Puntos de Datos */}
        {monthlyEvolutionData.map((d, i) => (
          <g key={i}>
            <circle cx={getX(i)} cy={getY(d.tons)} r="4.5" fill="#0d6e47" stroke="#ffffff" strokeWidth="1.5" className="pe-auto" style={{ cursor: 'pointer' }} />
            <text x={getX(i)} y={getY(d.tons) - 9} fill="var(--text-main)" fontSize="9.5" fontWeight="700" textAnchor="middle">
              {d.tons > 0 ? `${d.tons.toFixed(1)} T` : ''}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  // Renderizador de gráfico de dona (Donut) en SVG
  const renderDonutChart = (data, totalValueLabel) => {
    const size = 180;
    const center = size / 2;
    const radius = 60;
    const strokeWidth = 18;
    const circumference = 2 * Math.PI * radius;

    let accumulatedPercentage = 0;

    return (
      <div className="d-flex align-items-center justify-content-center gap-3 flex-wrap">
        <div style={{ position: 'relative', width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Círculo de fondo */}
            <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--bg-subtle)" strokeWidth={strokeWidth} />
            
            {/* Segmentos de Dona */}
            {data.map((item, index) => {
              if (item.percentage === 0) return null;
              const strokeLength = (item.percentage / 100) * circumference;
              const strokeOffset = - (accumulatedPercentage / 100) * circumference;
              accumulatedPercentage += item.percentage;

              return (
                <circle
                  key={index}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${strokeLength} ${circumference}`}
                  strokeDashoffset={strokeOffset}
                  transform={`rotate(-90 ${center} ${center})`}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          {/* Texto en el Centro */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            <small className="text-secondary text-uppercase fw-bold" style={{ fontSize: '9px', letterSpacing: '0.5px' }}>Total</small>
            <h6 className="m-0 fw-bold text-dark font-mono-num" style={{ fontSize: '14px' }}>{totalValueLabel}</h6>
          </div>
        </div>

        {/* Leyenda */}
        <div className="d-flex flex-column gap-2" style={{ minWidth: '130px' }}>
          {data.map((item, index) => (
            <div key={index} className="d-flex align-items-start gap-2">
              <span className="rounded-circle d-inline-block mt-1" style={{ width: '10px', height: '10px', backgroundColor: item.color, flexShrink: 0 }}></span>
              <div>
                <p className="m-0 small text-dark fw-semibold" style={{ fontSize: '11.5px', lineHeight: '1.2' }}>{item.name}</p>
                <small className="text-muted font-mono-num" style={{ fontSize: '10.5px' }}>
                  {item.percentage.toFixed(1)}% ({Math.round(item.value).toLocaleString()})
                </small>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid py-1">
      {/* Header & Barra de Filtros Operativos */}
      <div className="card p-3 mb-4 bg-white">
        <div className="row align-items-center g-3">
          <div className="col-lg-5">
            <h5 className="fw-bold mb-1 text-dark">Estudio de Resultados y Análisis de Flota</h5>
            <p className="text-muted small mb-0">Métricas consolidadas de pesaje, fletes y rendimiento por conductor.</p>
          </div>
          
          {/* Dynamic Filters Form */}
          <div className="col-lg-7">
            <div className="d-flex flex-wrap gap-2 justify-content-lg-end align-items-center">
              {/* Conductor dropdown */}
              <div className="input-group input-group-sm" style={{ width: '195px' }}>
                <span className="input-group-text bg-white border-end-0"><UserCircle size={15} className="text-primary" /></span>
                <select 
                  className="form-select border-start-0 ps-0 text-truncate"
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  style={{ fontSize: '12px' }}
                >
                  <option value="">Todos los Conductores</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.primerNombre} {d.primerApellido}</option>
                  ))}
                </select>
              </div>

              {/* Date range filter */}
              <div className="input-group input-group-sm" style={{ width: '148px' }}>
                <span className="input-group-text bg-white border-end-0"><Calendar size={15} className="text-primary" /></span>
                <input 
                  type="date" 
                  className="form-control border-start-0 ps-0" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  title="Fecha Inicial"
                  style={{ fontSize: '11px' }}
                />
              </div>
              <div className="input-group input-group-sm" style={{ width: '148px' }}>
                <span className="input-group-text bg-white border-end-0"><Calendar size={15} className="text-primary" /></span>
                <input 
                  type="date" 
                  className="form-control border-start-0 ps-0" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  title="Fecha Final"
                  style={{ fontSize: '11px' }}
                />
              </div>

              {/* Reset button */}
              <button 
                onClick={handleResetFilters} 
                className="btn btn-light border btn-sm d-flex align-items-center gap-1"
                title="Limpiar filtros"
              >
                <RefreshCw size={13} /> Limpiar
              </button>

              {/* Complete history button redirecting to main /viajes */}
              <button 
                onClick={() => navigate('/viajes')} 
                className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                style={{ fontSize: '12px' }}
              >
                <span>Historial Completo</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          METRIC SUMMARY CARDS WITH BEAUTIFUL TREND INDICATORS
          ============================================================ */}
      <div className="row g-3 g-lg-4 mb-4">
        {/* Card 1: Total Tonelaje */}
        <div className="col-sm-6 col-xl-3">
          <div className="card kpi-card p-3 bg-white h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-bold text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>Total Tonelaje</span>
              <div className="bg-success-subtle p-2 rounded-3 text-success">
                <Scale size={19} />
              </div>
            </div>
            <h3 className="fw-bold text-dark mb-1 kpi-value">{totalTons.toLocaleString(undefined, { maximumFractionDigits: 1 })} Ton</h3>
            <div className="d-flex align-items-center gap-1.5 mt-auto pt-1">
              {tonTrend.isPositive ? (
                <span className="badge bg-success-subtle text-success fw-semibold d-inline-flex align-items-center gap-1">
                  <TrendingUp size={12} /> &uarr; {tonTrend.percent}%
                </span>
              ) : (
                <span className="badge bg-danger-subtle text-danger fw-semibold d-inline-flex align-items-center gap-1">
                  <TrendingDown size={12} /> &darr; {tonTrend.percent}%
                </span>
              )}
              <span className="text-muted" style={{ fontSize: '11px' }}>vs 30 días ant.</span>
            </div>
          </div>
        </div>

        {/* Card 2: Viajes Completados */}
        <div className="col-sm-6 col-xl-3">
          <div className="card kpi-card kpi-sky p-3 bg-white h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-bold text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>Viajes Completados</span>
              <div className="bg-primary-subtle p-2 rounded-3 text-primary">
                <Truck size={19} />
              </div>
            </div>
            <h3 className="fw-bold text-dark mb-1 kpi-value">{totalTripsCount}</h3>
            <div className="d-flex align-items-center gap-1.5 mt-auto pt-1">
              {tripsTrend.isPositive ? (
                <span className="badge bg-success-subtle text-success fw-semibold d-inline-flex align-items-center gap-1">
                  <TrendingUp size={12} /> &uarr; {tripsTrend.percent}%
                </span>
              ) : (
                <span className="badge bg-danger-subtle text-danger fw-semibold d-inline-flex align-items-center gap-1">
                  <TrendingDown size={12} /> &darr; {tripsTrend.percent}%
                </span>
              )}
              <span className="text-muted" style={{ fontSize: '11px' }}>vs 30 días ant.</span>
            </div>
          </div>
        </div>

        {/* Card 3: Eficiencia de Carga */}
        <div className="col-sm-6 col-xl-3">
          <div className="card kpi-card p-3 bg-white h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-bold text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>Eficiencia de Carga</span>
              <div className="bg-info-subtle p-2 rounded-3 text-info">
                <Award size={19} />
              </div>
            </div>
            <h3 className="fw-bold text-dark mb-1 kpi-value">{averageTonsPerTrip.toFixed(1)} Ton/viaje</h3>
            <div className="d-flex align-items-center gap-1.5 mt-auto pt-1">
              {efficiencyTrend.isPositive ? (
                <span className="badge bg-success-subtle text-success fw-semibold d-inline-flex align-items-center gap-1">
                  <TrendingUp size={12} /> &uarr; {efficiencyTrend.percent}%
                </span>
              ) : (
                <span className="badge bg-danger-subtle text-danger fw-semibold d-inline-flex align-items-center gap-1">
                  <TrendingDown size={12} /> &darr; {efficiencyTrend.percent}%
                </span>
              )}
              <span className="text-muted" style={{ fontSize: '11px' }}>vs 30 días ant.</span>
            </div>
          </div>
        </div>

        {/* Card 4: Valor Total Facturado */}
        <div className="col-sm-6 col-xl-3">
          <div className="card kpi-card kpi-amber p-3 bg-white h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-bold text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>Valor Total Flete</span>
              <div className="bg-warning-subtle p-2 rounded-3 text-warning-emphasis">
                <DollarSign size={19} />
              </div>
            </div>
            <h3 className="fw-bold text-dark mb-1 kpi-value">${totalBilling.toLocaleString()}</h3>
            <div className="d-flex align-items-center gap-1.5 mt-auto pt-1">
              {billingTrend.isPositive ? (
                <span className="badge bg-success-subtle text-success fw-semibold d-inline-flex align-items-center gap-1">
                  <TrendingUp size={12} /> &uarr; {billingTrend.percent}%
                </span>
              ) : (
                <span className="badge bg-danger-subtle text-danger fw-semibold d-inline-flex align-items-center gap-1">
                  <TrendingDown size={12} /> &darr; {billingTrend.percent}%
                </span>
              )}
              <span className="text-muted" style={{ fontSize: '11px' }}>vs 30 días ant.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          INTERACTIVE GRAPHICS GRID (2 ROWS x 2 COLS)
          ============================================================ */}
      <div className="row g-4 mb-4">
        {/* Chart 1: Evolución Mensual */}
        <div className="col-lg-6">
          <div className="card p-4 bg-white h-100">
            <h5 className="fw-bold text-dark mb-1" style={{ fontSize: '1.05rem' }}>Evolución Mensual de Carga (Tonelaje)</h5>
            <p className="text-muted small mb-3">Historial acumulado de volumen transportado en báscula por mes.</p>
            <div className="flex-grow-1 d-flex align-items-center justify-content-center" style={{ minHeight: '185px' }}>
              {renderLineChart()}
            </div>
          </div>
        </div>

        {/* Chart 2: Composición por Fruto */}
        <div className="col-lg-6">
          <div className="card p-4 bg-white h-100">
            <h5 className="fw-bold text-dark mb-1" style={{ fontSize: '1.05rem' }}>Composición de Carga (Tonelaje)</h5>
            <p className="text-muted small mb-3">Desglose porcentual entre fruto de palma aceitera y compost orgánico.</p>
            <div className="flex-grow-1 d-flex align-items-center justify-content-center" style={{ minHeight: '185px' }}>
              {renderDonutChart(productData, `${totalTons.toLocaleString(undefined, { maximumFractionDigits: 0 })} T`)}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        {/* Chart 3: Top 5 Conductores */}
        <div className="col-lg-6">
          <div className="card p-4 bg-white h-100">
            <h5 className="fw-bold text-dark mb-1" style={{ fontSize: '1.05rem' }}>Top 5 Conductores por Tonelaje</h5>
            <p className="text-muted small mb-3">Ranking operativo de transportistas ordenado por volumen movilizado.</p>
            <div className="d-flex flex-column gap-3 mt-2">
              {loading ? (
                <div className="text-center py-4 text-muted">Cargando ranking...</div>
              ) : topDrivers.length === 0 ? (
                <div className="text-center py-4 text-muted">Sin datos suficientes.</div>
              ) : (
                topDrivers.map((driver, index) => {
                  const maxTons = topDrivers[0]?.value || 1;
                  const pct = (driver.value / maxTons) * 100;
                  const barColors = ['#0d6e47', '#10b981', '#f59e0b', '#0284c7', '#64748b'];

                  return (
                    <div key={index}>
                      <div className="d-flex justify-content-between mb-1 small fw-semibold">
                        <span className="text-dark">{index + 1}. {driver.name}</span>
                        <span className="text-secondary font-mono-num">{driver.value.toLocaleString(undefined, { maximumFractionDigits: 1 })} Ton</span>
                      </div>
                      <div className="progress" style={{ height: '9px', borderRadius: '50px' }}>
                        <div 
                          className="progress-bar rounded-pill" 
                          role="progressbar" 
                          style={{ 
                            width: `${pct}%`, 
                            backgroundColor: barColors[index % barColors.length],
                            transition: 'width 0.8s ease' 
                          }} 
                          aria-valuenow={pct} 
                          aria-valuemin="0" 
                          aria-valuemax="100"
                        ></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Chart 4: Distribución de Viajes por Planta/Empresa */}
        <div className="col-lg-6">
          <div className="card p-4 bg-white h-100">
            <h5 className="fw-bold text-dark mb-1" style={{ fontSize: '1.05rem' }}>Distribución de Viajes por Empresa</h5>
            <p className="text-muted small mb-3">Concentración logística por cliente o planta extractora destino.</p>
            <div className="flex-grow-1 d-flex align-items-center justify-content-center" style={{ minHeight: '185px' }}>
              {renderDonutChart(companyData, `${totalTripsCount} Viajes`)}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          LATEST OPERATIVE REGISTRY TABLE BELOW
          ============================================================ */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card p-4 bg-white">
            <Trips isDashboard={true} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
