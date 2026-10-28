import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { DollarSign, Filter, Download, Table, Calendar, AlertCircle, Search } from 'lucide-react';
import XLSX from 'xlsx-js-style';

const Finance = () => {
  const { isAdmin } = useAuth();
  const [trips, setTrips] = useState([]);
  const [stats, setStats] = useState({
    totalTons: 0,
    totalBilling: 0,
    totalAcpm: 0,
    totalFerryCrossings: 0
  });
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isAdmin()) {
      fetchReport();
    }
  }, []);

  const fetchReport = async (customStart = startDate, customEnd = endDate) => {
    setLoading(true);
    try {
      let url = '/finanzas/report';
      const params = [];
      if (customStart) params.push(`startDate=${customStart}`);
      if (customEnd) params.push(`endDate=${customEnd}`);
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const { data } = await api.get(url);
      setTrips(data.trips);
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching finance report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (e) => {
    e.preventDefault();
    fetchReport(startDate, endDate);
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
    fetchReport('', '');
  };

  const filteredTrips = trips.filter(t => 
    t.ticket.toString().includes(searchTerm)
  );

  const displayedStats = searchTerm.trim() === '' ? stats : filteredTrips.reduce((acc, t) => {
    const billing = Number(t.valorPago || 0);
    const driverCost = Number(t.valorConductor || 0);
    const acpmCost = t.usoAcpm ? Number(t.valorAcpm || 0) : 0;
    const ferryCost = t.usoFerry ? Number(t.valorFerry || 0) : 0;
    const expenses = driverCost + acpmCost + ferryCost;

    return {
      totalTons: Number((acc.totalTons + Number(t.tonelaje || 0)).toFixed(3)),
      totalBilling: Number((acc.totalBilling + billing).toFixed(2)),
      totalDriverPayout: Number((acc.totalDriverPayout + driverCost).toFixed(2)),
      totalAcpmCost: Number((acc.totalAcpmCost + acpmCost).toFixed(2)),
      totalFerryCost: Number((acc.totalFerryCost + ferryCost).toFixed(2)),
      totalExpenses: Number((acc.totalExpenses + expenses).toFixed(2)),
      totalNet: Number((acc.totalNet + (billing - expenses)).toFixed(2))
    };
  }, {
    totalTons: 0,
    totalBilling: 0,
    totalDriverPayout: 0,
    totalAcpmCost: 0,
    totalFerryCost: 0,
    totalExpenses: 0,
    totalNet: 0
  });

  /**
   * EXPORTACIÓN DE REPORTES EN FORMATO EXCEL (.xlsx)
   * - Procesa los datos filtrados en memoria de la grilla de finanzas.
   * - Aplica la consistencia de zona horaria (UTC) para evitar desfase de 1 día en fechas.
   * - Auto-ajusta el ancho de columnas (wchs) de forma dinámica para estética premium.
   */
  const exportToExcel = () => {
    if (filteredTrips.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    // Formateo explícito de los registros para coincidir 100% con la planilla Viajes Novapalma.xlsx
    const formattedData = filteredTrips.map(t => {
      const driverVal = Number(t.valorConductor || 0);
      const acpmVal = t.usoAcpm ? Number(t.valorAcpm || 0) : 0;
      const ferryVal = t.usoFerry ? Number(t.valorFerry || 0) : 0;
      const totalExpenses = driverVal + acpmVal + ferryVal;
      const netUtility = Number(t.valorPago) - totalExpenses;
      
      const valorTon = Number(t.tonelaje) > 0 
        ? parseFloat((Number(t.valorPago) / (Number(t.tonelaje) * 1000)).toFixed(3)) 
        : 0;

      return {
        'Fecha': new Date(t.fecha).toLocaleDateString(undefined, { timeZone: 'UTC' }),
        'PLACA': t.vehicle?.placa || '',
        'Conductor': t.driver ? `${t.driver.primerNombre} ${t.driver.primerApellido}` : '',
        'Empresa': t.empresa || 'N/A',
        'ORIGEN': t.origen || '',
        'DESTINO': t.destino || 'N/A',
        'PRODUCTO': t.producto || '',
        'TIQUETE': t.ticket || 0,
        'KILOGRAMOS': Number(t.tonelaje) * 1000,
        'VALOR TONELADA': valorTon,
        'VALOR FLETE VIAJE': Number(t.valorPago),
        'PORCENTAJE CONDUCTOR': driverVal,
        'ACPM': acpmVal,
        'FERRY': ferryVal,
        'GASTOS': totalExpenses,
        'NETO': netUtility
      };
    });

    // Conversión de JSON estructurado a hoja física de XLSX
    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // Definición de estilos premium
    const headerStyle = {
      font: { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '0F172A' } }, // Slate 900
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '475569' } },
        bottom: { style: 'medium', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '475569' } },
        right: { style: 'thin', color: { rgb: '475569' } }
      }
    };

    const borderStyle = {
      top: { style: 'thin', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
      left: { style: 'thin', color: { rgb: 'E2E8F0' } },
      right: { style: 'thin', color: { rgb: 'E2E8F0' } }
    };

    const textStyleLeft = {
      font: { name: 'Segoe UI', sz: 10 },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: borderStyle
    };

    const textStyleCenter = {
      font: { name: 'Segoe UI', sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: borderStyle
    };

    const numStyleRight = {
      font: { name: 'Segoe UI', sz: 10 },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: borderStyle
    };

    // Aplicar estilos a cada celda de forma dinámica
    for (const key in worksheet) {
      if (key.startsWith('!')) continue;
      
      const cell = worksheet[key];
      const colLetter = key.replace(/[0-9]/g, '');
      const rowNum = parseInt(key.replace(/[^0-9]/g, ''), 10);

      if (rowNum === 1) {
        cell.s = headerStyle;
        continue;
      }

      // Base Style por alineación y tipo de columna
      let baseStyle = textStyleCenter; // Por defecto centrado (Fecha, Placa, Producto, Tiquete)
      
      if (['C', 'D', 'E', 'F'].includes(colLetter)) {
        // Conductor, Empresa, ORIGEN, DESTINO -> Izquierda
        baseStyle = textStyleLeft;
      } else if (['I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'].includes(colLetter)) {
        // Kilogramos y valores numéricos/monetarios -> Derecha
        baseStyle = numStyleRight;
      }

      // Copia profunda del estilo base para no alterar celdas compartidas
      const cellStyle = JSON.parse(JSON.stringify(baseStyle));

      // Aplicar formato de número/moneda de Excel nativo
      if (cell.t === 'n' || !isNaN(cell.v)) {
        cell.t = 'n'; // Asegurar tipo número
        if (colLetter === 'H') {
          cell.z = '0'; // Tiquete sin decimales
        } else if (colLetter === 'I') {
          cell.z = '#,##0;[Red](#,##0);0'; // Kilogramos
        } else if (colLetter === 'J') {
          cell.z = '"$"#,##0.00;[Red]("$"#,##0.00);"$0.00"'; // Valor Tonelada con 2 decimales
        } else {
          cell.z = '"$"#,##0;[Red]("$"#,##0);"$0"'; // Financiero normal
        }
      }

      // Aplicar Cebra (filas pares de Excel tienen fondo ligeramente grisáceo)
      if (rowNum % 2 === 0) {
        cellStyle.fill = { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } }; // Slate 50
      }

      cell.s = cellStyle;
    }
    
    // Auto-fit dinámico de columnas según longitud máxima del contenido de la columna + 3 padding
    const colWidths = Object.keys(formattedData[0] || {}).map(key => {
      const maxLength = Math.max(
        key.length,
        ...formattedData.map(row => String(row[key] || '').length)
      );
      return { wch: maxLength + 3 };
    });
    worksheet['!cols'] = colWidths;

    // Altura de filas para mejorar la visualización y dar espacio ("respiración") al diseño
    const rowsCount = formattedData.length + 1;
    const rowHeights = [];
    for (let r = 0; r < rowsCount; r++) {
      if (r === 0) {
        rowHeights.push({ hpt: 26 }); // Cabecera más alta
      } else {
        rowHeights.push({ hpt: 20 }); // Filas de datos cómodas
      }
    }
    worksheet['!rows'] = rowHeights;

    // Crea el libro de trabajo (workbook) y añade la pestaña de reporte consolidado
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hoja1'); // Nombre de pestaña 'Hoja1' igual que el original

    // Dispara la descarga del reporte etiquetado con la marca temporal actual
    XLSX.writeFile(workbook, `reporte_financiero_novapalma_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (!isAdmin()) {
    return <div className="alert alert-danger p-3">Acceso restringido. Solo administradores.</div>;
  }

  return (
    <div className="container-fluid print-container">
      {/* Header section hidden during print */}
      <div className="d-flex justify-content-between align-items-center mb-4 no-print">
        <div>
          <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <DollarSign className="text-primary" size={24} />
            Reportes y Finanzas Logísticas
          </h4>
          <p className="text-muted small">Visualiza balances consolidados, filtra despachos y genera informes oficiales para auditoría.</p>
        </div>
        <div className="d-flex gap-2">
          <button onClick={exportToExcel} className="btn btn-outline-success d-flex align-items-center gap-2">
            <Download size={18} /> Exportar Excel
          </button>
        </div>
      </div>

      {/* Date Filters form - hidden during print */}
      <div className="card p-3 mb-4 no-print bg-white">
        <form onSubmit={handleFilter} className="row g-3 align-items-end">
          <div className="col-md-3">
            <label className="form-label small fw-bold text-secondary">Fecha Inicial</label>
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0"><Calendar size={17} className="text-primary" /></span>
              <input 
                type="date" 
                className="form-control border-start-0 ps-0" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
            </div>
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-bold text-secondary">Fecha Final</label>
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0"><Calendar size={17} className="text-primary" /></span>
              <input 
                type="date" 
                className="form-control border-start-0 ps-0" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-bold text-secondary">Buscar por Tiquete</label>
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0"><Search size={17} className="text-primary" /></span>
              <input 
                type="text" 
                className="form-control border-start-0 ps-0" 
                placeholder="Ej: 1045" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
          </div>
          <div className="col-md-3 d-flex gap-2">
            <button type="submit" className="btn btn-primary flex-grow-1 d-flex align-items-center justify-content-center gap-2">
              <Filter size={17} /> Filtrar Fechas
            </button>
            <button type="button" onClick={handleReset} className="btn btn-light border">
              Limpiar
            </button>
          </div>
        </form>
      </div>

      {/* Financial Summary Cards (Screen Only) */}
      <div className="row g-3 g-lg-4 mb-4 no-print">
        <div className="col-sm-6 col-xl-3">
          <div className="card kpi-card kpi-sky p-3 bg-white h-100">
            <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>Ingresos Totales (Flete)</small>
            <h3 className="fw-bold text-dark mt-2 mb-1 kpi-value">${Number(displayedStats.totalBilling || 0).toLocaleString()}</h3>
            <span className="small text-muted mt-auto">COP facturado bruto</span>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card kpi-card kpi-danger p-3 bg-white h-100">
            <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>Gastos Operativos (Total)</small>
            <h3 className="fw-bold text-danger mt-2 mb-1 kpi-value">-${Number(displayedStats.totalExpenses || 0).toLocaleString()}</h3>
            <span className="small text-muted mt-auto">Conductor + ACPM + Ferry</span>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card kpi-card p-3 bg-white h-100">
            <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>Utilidad Neta (Neto)</small>
            <h3 className="fw-bold text-success mt-2 mb-1 kpi-value">${Number(displayedStats.totalNet || 0).toLocaleString()}</h3>
            <span className="small text-muted mt-auto">COP rentabilidad real</span>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card kpi-card kpi-amber p-3 bg-white h-100">
            <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>Desglose de Gastos</small>
            <div className="mt-2 small font-mono-num" style={{ fontSize: '12px' }}>
              <div className="d-flex justify-content-between mb-1"><span className="text-muted">Conductor:</span> <span className="fw-bold text-dark">${Number(displayedStats.totalDriverPayout || 0).toLocaleString()}</span></div>
              <div className="d-flex justify-content-between mb-1"><span className="text-muted">ACPM:</span> <span className="fw-bold text-dark">${Number(displayedStats.totalAcpmCost || 0).toLocaleString()}</span></div>
              <div className="d-flex justify-content-between"><span className="text-muted">Ferry:</span> <span className="fw-bold text-dark">${Number(displayedStats.totalFerryCost || 0).toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Report Title - only visible when printing */}
      <div className="print-only mb-4 text-center print-header">
        <h3 className="fw-bold text-dark m-0" style={{ fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>NOVAPALMA LOGÍSTICA S.A.S.</h3>
        <p className="text-secondary small m-1" style={{ fontSize: '10px' }}>Nit: 900.123.456-7 — Reporte Oficial de Auditoría Financiera</p>
        <div style={{ borderBottom: '2px solid #0f172a', margin: '10px 0' }}></div>
        <div className="d-flex justify-content-between text-muted" style={{ fontSize: '9px', padding: '0 5px' }}>
          <span><strong>Fecha de Generación:</strong> {new Date().toLocaleString()}</span>
          <span><strong>Rango de Auditoría:</strong> {startDate || 'Desde el origen'} hasta {endDate || 'Fecha actual'}</span>
        </div>
      </div>

      {/* Financial Summary for Print Only (Formal Accounting Table) */}
      <div className="print-only mb-4">
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontSize: '9.5px', backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold', textAlign: 'left', textTransform: 'uppercase' }}>Concepto de Balance</th>
              <th style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontSize: '9.5px', backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold', textAlign: 'right', textTransform: 'uppercase' }}>Ingresos Brutos (Flete)</th>
              <th style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontSize: '9.5px', backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold', textAlign: 'right', textTransform: 'uppercase' }}>Egresos Operativos Totales</th>
              <th style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontSize: '9.5px', backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold', textAlign: 'right', textTransform: 'uppercase' }}>Utilidad Neta del Ejercicio</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: '10.5px', color: '#0f172a', fontWeight: '500' }}>Balance Consolidado del Periodo (COP)</td>
              <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: '10.5px', color: '#0f172a', textAlign: 'right', fontWeight: '500' }}>${Number(displayedStats.totalBilling || 0).toLocaleString()}</td>
              <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: '10.5px', color: '#ef4444', textAlign: 'right', fontWeight: '500' }}>-${Number(displayedStats.totalExpenses || 0).toLocaleString()}</td>
              <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: '10.5px', color: '#10b981', textAlign: 'right', fontWeight: 'bold' }}>${Number(displayedStats.totalNet || 0).toLocaleString()}</td>
            </tr>
            <tr>
              <td colSpan="4" style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: '8.5px', color: '#475569', backgroundColor: '#f8fafc', fontStyle: 'italic' }}>
                <strong>Desglose Detallado de Egresos Auditados:</strong> 
                Pago Neto Conductores: ${Number(displayedStats.totalDriverPayout || 0).toLocaleString()} COP | 
                Combustible ACPM Consumido: ${Number(displayedStats.totalAcpmCost || 0).toLocaleString()} COP | 
                Cruce de Ferrys y Peajes: ${Number(displayedStats.totalFerryCost || 0).toLocaleString()} COP
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Trips Table */}
      <div className="card border-0 shadow-sm bg-white print-card-wrapper">
        <div className="card-header bg-transparent border-0 pt-4 px-4 d-flex justify-content-between align-items-center no-print">
          <h5 className="fw-bold m-0 d-flex align-items-center gap-2">
            <Table size={20} className="text-secondary" />
            Desglose de Despachos Auditados
          </h5>
          <span className="badge bg-light text-dark border px-3 py-2 small">{filteredTrips.length} registros encontrados</span>
        </div>
        <div className="table-responsive p-2">
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
                <th className="py-3 text-secondary small text-uppercase fw-bold">Costo ACPM</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Costo Ferry</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Pago Cond.</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold">Gastos</th>
                <th className="py-3 text-secondary small text-uppercase fw-bold px-4 text-end">Flete (Ingreso)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                    Cargando informe...
                  </td>
                </tr>
              ) : filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan="12" className="text-center py-5 text-muted">
                    {trips.length === 0 ? 'No se encontraron registros de viajes en el rango seleccionado.' : 'Ningún tiquete coincide con tu búsqueda.'}
                  </td>
                </tr>
              ) : (
                filteredTrips.map((t) => {
                  const driverVal = Number(t.valorConductor || 0);
                  const acpmVal = t.usoAcpm ? Number(t.valorAcpm || 0) : 0;
                  const ferryVal = t.usoFerry ? Number(t.valorFerry || 0) : 0;
                  const totalExpenses = driverVal + acpmVal + ferryVal;

                  return (
                    <tr key={t.id}>
                      <td className="px-4"><span className="ticket-badge">#{t.ticket}</span></td>
                      <td className="font-mono-num small">{new Date(t.fecha).toLocaleDateString(undefined, { timeZone: 'UTC' })}</td>
                      <td><span className="plate-badge">{t.vehicle?.placa}</span></td>
                      <td className="small fw-medium">
                        {t.origen} 
                        {t.destino ? <span className="text-secondary"> &rarr; {t.destino}</span> : ''}
                      </td>
                      <td className="text-muted small">{t.empresa || 'N/A'}</td>
                      <td>
                        <span className={`badge px-2.5 py-1 rounded-pill ${t.producto === 'FRUTO' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning-emphasis'}`}>
                          {t.producto}
                        </span>
                      </td>
                      <td className="font-mono-num fw-medium small">{t.tonelaje} Ton</td>
                      <td className="text-danger small font-mono-num">${acpmVal.toLocaleString()}</td>
                      <td className="text-danger small font-mono-num">${ferryVal.toLocaleString()}</td>
                      <td className="text-success small fw-medium font-mono-num">
                        ${driverVal.toLocaleString()} <small className="text-muted">({Number(t.porcentajeConductor || 1.0)}%)</small>
                      </td>
                      <td className="text-danger small fw-semibold font-mono-num">${totalExpenses.toLocaleString()}</td>
                      <td className="fw-bold px-4 text-end text-dark font-mono-num">${Number(t.valorPago).toLocaleString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sign-off & Audit Section for Print Only */}
      <div className="print-only audit-signatures mt-5 pt-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px' }}>
          <div className="sig-box">
            <div className="sig-line"></div>
            <span className="sig-title">Director de Logística</span>
            <span className="sig-desc">Novapalma S.A.S.</span>
          </div>
          <div className="sig-box">
            <div className="sig-line"></div>
            <span className="sig-title">Auditor Financiero</span>
            <span className="sig-desc">Control Operativo</span>
          </div>
          <div className="sig-box">
            <div className="sig-line"></div>
            <span className="sig-title">Representante de Contratista</span>
            <span className="sig-desc">Firma y Sello Comercial</span>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: letter landscape;
            margin: 12mm 15mm 15mm 15mm;
          }
          
          /* Evitar cortes feos e inhabilitar viewport fijo de React Layout */
          html, body, #root, .d-flex, main {
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            display: block !important;
            background-color: white !important;
            color: #000000 !important;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print-only {
            display: block !important;
          }
          
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          .print-card-wrapper {
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            border-radius: 4px !important;
            background-color: white !important;
            overflow: visible !important;
            margin-top: 15px !important;
          }
          
          /* Tabla Optimizada para Impresión de Múltiples Páginas y Austera */
          .table-responsive {
            overflow: visible !important;
            display: block !important;
            width: 100% !important;
          }
          
          .table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }
          
          .table thead {
            display: table-header-group !important; /* Repetir cabecera en cada página */
          }
          
          .table tr {
            page-break-inside: avoid !important; /* No cortar filas a la mitad */
          }
          
          .table thead th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            font-size: 8px !important;
            font-weight: 700 !important;
            padding: 6px 4px !important;
            border: 1px solid #94a3b8 !important;
            text-transform: uppercase !important;
            text-align: left !important;
          }

          .table thead th:last-child {
            text-align: right !important;
          }
          
          .table tbody td {
            font-size: 8px !important;
            padding: 5px 4px !important;
            border: 1px solid #cbd5e1 !important;
            color: #0f172a !important;
          }

          .table tbody td:last-child {
            text-align: right !important;
          }
          
          .table tbody tr:nth-child(even) td {
            background-color: #f8fafc !important; /* Filas alternas tenues */
          }

          /* Desactivar insignias coloreadas llamativas en favor de texto plano serio */
          .table td .badge,
          .table td .ticket-badge,
          .table td .plate-badge {
            background-color: transparent !important;
            color: #0f172a !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            font-size: 8px !important;
            font-weight: normal !important;
          }
          
          /* Firmas Auditables Austeras */
          .audit-signatures {
            page-break-inside: avoid !important;
            margin-top: 50px !important;
          }
          
          .sig-box {
            width: 28% !important;
            text-align: center !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
          }
          
          .sig-line {
            width: 180px !important;
            border-top: 1px solid #475569 !important;
            margin-bottom: 6px !important;
          }
          
          .sig-title {
            font-size: 9px !important;
            font-weight: 700 !important;
            color: #0f172a !important;
          }
          
          .sig-desc {
            font-size: 8px !important;
            color: #475569 !important;
          }
        }
        .print-only {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default Finance;
