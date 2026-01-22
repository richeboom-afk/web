import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { AgGridReact } from 'ag-grid-react';
import * as XLSX from "xlsx";

// --- AG GRID MODULES ---
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'; 
import type { ColDef, ColGroupDef, IRowNode } from 'ag-grid-community';
import "ag-grid-community/styles/ag-grid.css"; 
import "ag-grid-community/styles/ag-theme-balham.css"; 

ModuleRegistry.registerModules([ AllCommunityModule ]);

const SIGNAL_TYPES = ['VID', 'AUD', 'CTRL', 'DATA', 'POWER', 'RF', 'FIBER', 'OTHER'];

const incrementString = (str: string) => {
  return str.replace(/(\d+)(?!.*\d)/, (match) => {
    const nextVal = parseInt(match, 10) + 1;
    return nextVal.toString().padStart(match.length, '0');
  });
};

const GRID_STYLES = `
  html, body, #root { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; font-family: "Segoe UI", sans-serif; background-color: #f0f0f0; }
  .ag-icon, .ag-header-icon, .ag-icon-menu, .ag-icon-filter, .ag-icon-asc, .ag-icon-desc, .ag-icon-none { display: none !important; }
  .ag-theme-balham .ag-header-cell-label { justify-content: center !important; } 
  .ag-theme-balham .ag-cell { border-right: none !important; border-bottom: 1px solid #d9d9d9 !important; text-align: center; } 
  .a-side-header { background-color: #A0CCFF !important; } 
  .b-side-header { background-color: #B0FFB0 !important; } 
  .label-preview-container { background-color: #fff; border: 1px solid #000; padding: 12px; border-radius: 4px; font-family: 'Consolas', monospace; font-weight: bold; font-size: 13px; line-height: 1.2; height: 100px; overflow: hidden; }
  .sidebar-section { margin-bottom: 25px; }
  .sidebar-section h4 { border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; font-size: 0.95rem; color: #333; }
  .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer; margin-bottom: 8px; color: #444; }
  .btn { padding: 6px 14px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer; font-weight: 600; font-size: 0.85rem; }
  .btn-primary { background-color: #007bff; color: white; border-color: #0069d9; }
  .btn-dark { background-color: #444; color: white; border: 1px solid #666; }
  .btn-danger { background-color: #dc3545; color: white; border-color: #bd2130; }
  .btn-success { background-color: #28a745; color: white; border-color: #218838; }

  .path-visualizer { display: flex; align-items: center; gap: 10px; background: #222; padding: 5px 15px; border-radius: 6px; border: 1px solid #444; width: 300px; height: 40px; }
  .path-node { display: flex; flex-direction: column; align-items: center; min-width: 60px; }
  .node-label { font-size: 9px; color: #aaa; text-transform: uppercase; letter-spacing: 1px; }
  .node-value { font-size: 12px; color: #fff; font-weight: bold; }
  .path-line-container { flex: 1; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .path-line { width: 100%; height: 2px; background: #555; position: relative; }
  .path-line::before, .path-line::after { content: ''; position: absolute; width: 5px; height: 5px; background: #007bff; border-radius: 50%; top: -1.5px; }
  .path-line::before { left: 0; } .path-line::after { right: 0; }
  .wire-badge { position: absolute; top: -16px; background: #f39c12; color: #000; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 900; }
  .sig-badge { position: absolute; bottom: -16px; color: #00d4ff; font-size: 9px; font-weight: bold; }

  .dropdown { position: relative; display: inline-block; }
  .dropdown-content { display: none; position: absolute; left: 0; background-color: #fff; min-width: 160px; box-shadow: 0px 8px 16px rgba(0,0,0,0.2); z-index: 1000; border: 1px solid #ccc; border-radius: 4px; }
  .dropdown:hover .dropdown-content { display: block; }
  .dropdown-content button { width: 100%; padding: 10px; border: none; background: none; text-align: left; cursor: pointer; font-size: 0.85rem; }
  .dropdown-content button:hover { background-color: #f1f1f1; }

  .example-label-wrapper { background: #fff; border: 2px dashed #bbb; padding: 30px; display: flex; flex-direction: column; align-items: center; border-radius: 8px; margin-bottom: 20px; }
  .actual-label-stock { width: 350px; height: 150px; background: #fff; border: 1px solid #333; position: relative; display: flex; flex-direction: column; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
  .printable-area { height: 75%; width: 100%; background: #fff; border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: center; padding: 10px; box-sizing: border-box; font-family: 'Consolas', monospace; font-weight: bold; font-size: 14px; line-height: 1.2; overflow: hidden; }
  .text-block-aligner { text-align: left; white-space: nowrap; }
  .laminate-tail { height: 25%; width: 100%; background: rgba(0, 123, 255, 0.05); display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 2px; }
  .warning-banner { background: #ffdede; color: #d00; border: 1px solid #ffbaba; padding: 10px 20px; border-radius: 4px; font-weight: bold; margin-bottom: 15px; font-size: 0.85rem; display: flex; align-items: center; gap: 10px; }

  .sheet-map-container { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .sheet-grid { display: grid; grid-template-columns: repeat(8, 30px); grid-template-rows: repeat(4, 45px); gap: 4px; padding: 10px; background: #ddd; border: 1px solid #999; border-radius: 4px; }
  .sheet-cell { background: #fff; border: 1px solid #bbb; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #aaa; transition: 0.2s; }
  .sheet-cell:hover { background: #f0faff; border-color: #007bff; }
  .sheet-cell.selected { background: #007bff; color: white; border-color: #0056b3; font-weight: bold; }
`;

const STORAGE_KEY = "conneks.data.v1";

type WireRecord = {
  signalType?: string; src_dwg?: string; src_loc1?: string; src_loc2?: string; src_dev?: string; src_conn?: string; src_port?: string;
  dst_dwg?: string; dst_loc1?: string; dst_loc2?: string; dst_dev?: string; dst_conn?: string; dst_port?: string;
  color?: string; remarks?: string; wireType?: string; len?: string; wireNumber?: string;
};

export default function App() {
  const fileRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<AgGridReact<WireRecord>>(null);
  
  const [rowData, setRowData] = useState<WireRecord[]>([]);
  const [history, setHistory] = useState<WireRecord[][]>([]);
  const [selectedCable, setSelectedCable] = useState<WireRecord | null>(null);
  const [searchText, setSearchText] = useState("");
  const [view, setView] = useState<'home' | 'labels' | 'runlist'>('home');

  // Print Settings
  const [labelStock, setLabelStock] = useState<'mrlabel' | 'thermal'>('mrlabel');
  const [qtyPerRecord, setQtyPerRecord] = useState(1);
  const [printLoc1, setPrintLoc1] = useState(true);
  const [printLoc2, setPrintLoc2] = useState(true);
  const [printPort, setPrintPort] = useState(true);
  const [startPos, setStartPos] = useState(1);

  // Column Visibility
  const [showSignal, setShowSignal] = useState(true);
  const [showDwg, setShowDwg] = useState(true);
  const [showLoc1, setShowLoc1] = useState(true);
  const [showLoc2, setShowLoc2] = useState(true);
  const [showConn, setShowConn] = useState(true);
  const [showPort, setShowPort] = useState(true);
  const [showLen, setShowLen] = useState(true);
  const [showCblType, setShowCblType] = useState(true);
  const [showColor, setShowColor] = useState(true);
  const [showRemarks, setShowRemarks] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setRowData(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rowData));
  }, [rowData]);

  const saveHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(rowData))]);
  }, [rowData]);

  const handleUndo = useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      setRowData(prev[prev.length - 1]); 
      return prev.slice(0, -1);
    });
  }, []);

  const handleSmartClone = useCallback(() => {
    if (!selectedCable) return;
    saveHistory();
    let newWireNum = incrementString(selectedCable.wireNumber || "W000");
    while (rowData.some(r => r.wireNumber === newWireNum)) {
      newWireNum = incrementString(newWireNum);
    }
    const newRecord: WireRecord = {
      ...selectedCable,
      wireNumber: newWireNum,
      src_dev: selectedCable.src_dev ? incrementString(selectedCable.src_dev) : selectedCable.src_dev,
      dst_dev: selectedCable.dst_dev ? incrementString(selectedCable.dst_dev) : selectedCable.dst_dev
    };
    setRowData(prev => [...prev, newRecord]);
  }, [selectedCable, rowData, saveHistory]);

  // Select All Handler
  const handleSelectAll = (val: boolean) => {
    setShowSignal(val); setShowDwg(val); setShowLoc1(val); setShowLoc2(val);
    setShowConn(val); setShowPort(val); setShowLen(val); setShowCblType(val);
    setShowColor(val); setShowRemarks(val);
  };

  const isAllSelected = showSignal && showDwg && showLoc1 && showLoc2 && showConn && showPort && showLen && showCblType && showColor && showRemarks;

  const colDefs = useMemo<(ColDef | ColGroupDef)[]>(() => [
    { field: "wireNumber", headerName: "WIRE#", width: 90, pinned: "left" },
    { field: "signalType", headerName: "SIG", width: 80, hide: !showSignal, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: SIGNAL_TYPES } },
    {
      headerName: "A SIDE", headerClass: 'a-side-header',
      children: [
        { field: "src_dwg", headerName: "PAGE#", width: 75, hide: !showDwg },
        { field: "src_loc1", headerName: "LOC 1", width: 90, hide: !showLoc1 },
        { field: "src_loc2", headerName: "LOC 2", width: 90, hide: !showLoc2 },
        { field: "src_dev", headerName: "DEVICE", width: 120 },
        { field: "src_conn", headerName: "CONN", width: 90, hide: !showConn },
        { field: "src_port", headerName: "PORT", width: 85, hide: !showPort },
      ]
    },
    {
      headerName: "B SIDE", headerClass: 'b-side-header',
      children: [
        { field: "dst_dwg", headerName: "PAGE#", width: 75, hide: !showDwg },
        { field: "dst_loc1", headerName: "LOC 1", width: 90, hide: !showLoc1 },
        { field: "dst_loc2", headerName: "LOC 2", width: 90, hide: !showLoc2 },
        { field: "dst_dev", headerName: "DEVICE", width: 120 },
        { field: "dst_conn", headerName: "CONN", width: 90, hide: !showConn },
        { field: "dst_port", headerName: "PORT", width: 85, hide: !showPort },
      ]
    },
    { field: "len", headerName: "LEN", width: 75, hide: !showLen },
    { field: "wireType", headerName: "CBL TYPE", width: 100, hide: !showCblType },
    { field: "color", headerName: "COLOR", width: 80, hide: !showColor },
    { field: "remarks", headerName: "RMRKS", width: 110, hide: !showRemarks },
  ], [showSignal, showDwg, showLoc1, showLoc2, showConn, showPort, showLen, showCblType, showColor, showRemarks]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    saveHistory();
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const allRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      const markerIdx = allRows.findIndex(row => String(row[0] || "").toUpperCase().includes("RECORDS START"));
      if (markerIdx === -1) { alert("Marker not found."); return; }
      const translatedData: WireRecord[] = allRows.slice(markerIdx + 1)
        .map((row): WireRecord | null => {
          if (!row[1]) return null;
          return {
            wireNumber: String(row[1]), signalType: row[2],
            src_dwg: row[3], src_loc1: row[4], src_loc2: row[5], src_dev: row[6], src_conn: row[7], src_port: row[8],
            dst_dwg: row[10], dst_loc1: row[11], dst_loc2: row[12], dst_dev: row[13], dst_conn: row[14], dst_port: row[15],
            wireType: row[16], len: row[17], color: row[18], remarks: row[19]
          };
        }).filter((r): r is WireRecord => r !== null);
      setRowData(prev => [...prev, ...translatedData]);
    };
    reader.readAsBinaryString(file);
    e.target.value = ""; 
  };

  const isExternalFilterPresent = useCallback(() => searchText !== "", [searchText]);

  const doesExternalFilterPass = useCallback((node: IRowNode<WireRecord>) => {
    if (!searchText || !node.data) return true;
    const fuzzyRegex = new RegExp(searchText.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');
    return Object.values(node.data).some(val => fuzzyRegex.test(String(val || "")));
  }, [searchText]);

  const buildLabelLine = (side: 'A' | 'B', customData?: WireRecord) => {
    const s = customData || selectedCable;
    if (!s) return "";
    const loc1 = side === 'A' ? s.src_loc1 : s.dst_loc1;
    const loc2 = side === 'A' ? s.src_loc2 : s.dst_loc2;
    const dev = side === 'A' ? s.src_dev : s.dst_dev;
    const port = side === 'A' ? s.src_port : s.dst_port;
    return [s.wireNumber, printLoc1 ? loc1 : null, printLoc2 ? loc2 : null, dev, printPort ? port : null].filter(p => p).join(" ");
  };

  return (
    <>
      <style>{GRID_STYLES}</style> 
      <header style={{ height: '70px', backgroundColor: '#343a40', color: 'white', padding: '0 25px', display: 'flex', alignItems: 'center' }}>
        <h2 style={{ margin: 0, minWidth: '180px' }}>CONNEKS <span style={{fontWeight: '300', fontSize: '1.1rem', opacity: 0.8}}>Utility</span></h2>
        <div className="dropdown" style={{ marginLeft: '15px', marginRight: '15px' }}>
          <button className="btn btn-dark">Print ▾</button>
          <div className="dropdown-content">
            <button onClick={() => setView('labels')}>Print Labels</button>
            <button onClick={() => setView('runlist')}>Print Run List</button>
          </div>
        </div>
        <div className="path-visualizer">
          <div className="path-node">
            <span className="node-label">Source</span>
            <span className="node-value">{selectedCable?.src_dev || "---"}</span>
          </div>
          <div className="path-line-container">
            {selectedCable && <span className="wire-badge">{selectedCable.wireNumber}</span>}
            <div className="path-line"></div>
            {selectedCable && <span className="sig-badge">{selectedCable.signalType}</span>}
          </div>
          <div className="path-node">
            <span className="node-label">Destination</span>
            <span className="node-value">{selectedCable?.dst_dev || "---"}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {view === 'home' ? (
            <>
              <input style={{padding: '8px', borderRadius: '4px', border: '1px solid #555', background: '#fff', width: '180px'}} placeholder="Search..." value={searchText} onChange={e => { setSearchText(e.target.value); gridRef.current?.api.onFilterChanged(); }} />
              <button className="btn btn-dark" onClick={handleUndo}>Undo</button>
              <button className="btn btn-primary" onClick={() => { saveHistory(); setRowData([...rowData, { wireNumber: `NEW-${rowData.length + 1}` }]); }}>+ Add</button>
              <button className="btn btn-success" onClick={handleSmartClone} disabled={!selectedCable}>Clone</button>
              <button className="btn btn-dark" onClick={() => fileRef.current?.click()}>Import</button>
              <button className="btn btn-danger" onClick={() => {
                const selectedNodes = gridRef.current?.api.getSelectedNodes();
                if (selectedNodes?.length && window.confirm("Delete selected?")) {
                  saveHistory();
                  const selectedData = selectedNodes.map(node => node.data);
                  setRowData(prev => prev.filter(row => !selectedData.includes(row)));
                }
              }}>Delete</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => setView('home')}>Home</button>
          )}
          <input type="file" ref={fileRef} style={{display:'none'}} onChange={handleFileUpload} accept=".xlsx, .xls, .csv" />
        </div>
      </header>
      {view === 'home' ? (
        <div style={{ display: 'flex', height: 'calc(100vh - 70px)' }}> 
          <aside style={{ width: '280px', backgroundColor: 'white', borderRight: '1px solid #ddd', padding: '20px', overflowY: 'auto' }}>
            <div className="sidebar-section">
              <h4>Live Label Preview</h4>
              <div className="label-preview-container">
                {selectedCable ? <>{buildLabelLine('A')}<br/>{buildLabelLine('B')}<br/>{buildLabelLine('A')}<br/>{buildLabelLine('B')}</> : "Select a row..."}
              </div>
            </div>
            <div className="sidebar-section">
              <h4>Label Print Options</h4>
              <label className="checkbox-label"><input type="checkbox" checked={printLoc1} onChange={e => setPrintLoc1(e.target.checked)} /> Location 1</label>
              <label className="checkbox-label"><input type="checkbox" checked={printLoc2} onChange={e => setPrintLoc2(e.target.checked)} /> Location 2</label>
              <label className="checkbox-label"><input type="checkbox" checked={printPort} onChange={e => setPrintPort(e.target.checked)} /> Port</label>
            </div>
            <div className="sidebar-section">
              <h4>Show / Hide Columns</h4>
              <label className="checkbox-label" style={{fontWeight: 'bold', marginBottom: '12px', color: '#007bff'}}>
                <input type="checkbox" checked={isAllSelected} onChange={e => handleSelectAll(e.target.checked)} /> Select All
              </label>
              {[["Signal", showSignal, setShowSignal], ["Page", showDwg, setShowDwg], ["Loc 1", showLoc1, setShowLoc1], ["Loc 2", showLoc2, setShowLoc2], ["Conn", showConn, setShowConn], ["Port", showPort, setShowPort], ["Length", showLen, setShowLen], ["Cbl Type", showCblType, setShowCblType], ["Color", showColor, setShowColor], ["Remarks", showRemarks, setShowRemarks]].map(([label, val, set]: any) => (
                <label key={label} className="checkbox-label"><input type="checkbox" checked={val} onChange={e => set(e.target.checked)} /> {label}</label>
              ))}
            </div>
          </aside>
          <main style={{ flex: 1, padding: '10px' }}>
            <div className="ag-theme-balham" style={{ height: '100%', width: '100%' }}>
              <AgGridReact 
                ref={gridRef} rowData={rowData} columnDefs={colDefs} defaultColDef={{ editable: true, resizable: true, sortable: true }}
                isExternalFilterPresent={isExternalFilterPresent} doesExternalFilterPass={doesExternalFilterPass}
                rowSelection="multiple" onRowSelected={(e) => { const s = e.api.getSelectedRows(); setSelectedCable(s.length > 0 ? s[0] : null); }} 
              />
            </div>
          </main>
        </div>
      ) : (
        <div style={{ display: 'flex', height: 'calc(100vh - 70px)', background: '#f8f9fa' }}>
          <aside style={{ width: '320px', background: '#fff', borderRight: '1px solid #ddd', padding: '25px' }}>
            <div className="sidebar-section">
              <h4>Label Settings</h4>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '0.8rem', color: '#666' }}>Label Stock</label>
                <select style={{ width: '100%', padding: '8px', marginTop: '5px' }} value={labelStock} onChange={(e:any) => setLabelStock(e.target.value)}>
                  <option value="mrlabel">Mr-Label (8.5x11 Sheet)</option>
                  <option value="thermal">Thermal Roll (2.25" Wrap)</option>
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '0.8rem', color: '#666' }}>Quantity per Record</label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                  <button className={`btn ${qtyPerRecord === 1 ? 'btn-primary' : ''}`} onClick={() => setQtyPerRecord(1)}>1</button>
                  <button className={`btn ${qtyPerRecord === 2 ? 'btn-primary' : ''}`} onClick={() => setQtyPerRecord(2)}>2</button>
                </div>
              </div>
              <label className="checkbox-label"><input type="checkbox" checked={printLoc1} onChange={e => setPrintLoc1(e.target.checked)} /> Print Location 1</label>
              <label className="checkbox-label"><input type="checkbox" checked={printLoc2} onChange={e => setPrintLoc2(e.target.checked)} /> Print Location 2</label>
              <label className="checkbox-label"><input type="checkbox" checked={printPort} onChange={e => setPrintPort(e.target.checked)} /> Print Port</label>
            </div>
          </aside>
          <main style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="example-label-wrapper">
              <div className="actual-label-stock">
                <div className="printable-area">
                  <div className="text-block-aligner">
                    {buildLabelLine('A', rowData[0])}<br/>{buildLabelLine('B', rowData[0])}<br/>{buildLabelLine('A', rowData[0])}<br/>{buildLabelLine('B', rowData[0])}
                  </div>
                </div>
                <div className="laminate-tail">Clear Protective Wrap</div>
              </div>
            </div>
            {labelStock === 'mrlabel' && (
              <div className="sheet-map-container">
                <p style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Choose the first label spot:</p>
                <div className="sheet-grid">
                  {Array.from({ length: 32 }, (_, i) => (
                    <div key={i} className={`sheet-cell ${startPos === i + 1 ? 'selected' : ''}`} onClick={() => setStartPos(i + 1)}>{i + 1}</div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </>
  );
}