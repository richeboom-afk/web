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

type WireRecord = {
  signalType?: string; src_dwg?: string; src_loc1?: string; src_loc2?: string; src_dev?: string; src_conn?: string; src_port?: string;
  dst_dwg?: string; dst_loc1?: string; dst_loc2?: string; dst_dev?: string; dst_conn?: string; dst_port?: string;
  color?: string; remarks?: string; wireType?: string; len?: string; wireNumber?: string;
};

type JobMeta = {
  jobName: string;
  jobNumber: string;
  pm: string;
  pe: string;
};

export default function App() {
  const fileRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<AgGridReact<WireRecord>>(null);
  
  // --- JOB STATE ---
  const [isJobLoaded, setIsJobLoaded] = useState(false);
  const [jobMeta, setJobMeta] = useState<JobMeta>({ jobName: "", jobNumber: "", pm: "", pe: "" });

  // --- APP STATE ---
  const [rowData, setRowData] = useState<WireRecord[]>([]);
  
  // Undo/Redo Stacks
  const [history, setHistory] = useState<WireRecord[][]>([]);
  const [future, setFuture] = useState<WireRecord[][]>([]);

  const [selectedCable, setSelectedCable] = useState<WireRecord | null>(null);
  const [searchText, setSearchText] = useState("");
  const [view, setView] = useState<'home' | 'labels' | 'runlist'>('home');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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

  // --- JOB LOADING / SAVING ---
  const loadJob = () => {
    if (!jobMeta.jobName.trim()) return;
    const key = `conneks.data.${jobMeta.jobName.trim()}`;
    const savedString = localStorage.getItem(key);
    
    if (savedString) {
      const parsed = JSON.parse(savedString);
      if (Array.isArray(parsed)) {
        setRowData(parsed); 
      } else if (parsed.rows) {
        setRowData(parsed.rows);
        setJobMeta(parsed.meta); 
      }
    } else {
      setRowData([]); 
    }
    setIsJobLoaded(true);
  };

  useEffect(() => {
    if (isJobLoaded && jobMeta.jobName) {
      const key = `conneks.data.${jobMeta.jobName.trim()}`;
      const dataToSave = {
        meta: jobMeta,
        rows: rowData
      };
      localStorage.setItem(key, JSON.stringify(dataToSave));
    }
  }, [rowData, jobMeta, isJobLoaded]);

  // --- UNDO / REDO / HISTORY ---
  const saveHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(rowData))]);
    setFuture([]);
  }, [rowData]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    setFuture(prev => [rowData, ...prev]);
    setRowData(previous);
    setHistory(newHistory);
  }, [history, rowData]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);

    setHistory(prev => [...prev, rowData]);
    setRowData(next);
    setFuture(newFuture);
  }, [future, rowData]);

  // --- ACTIONS ---
  const handleDelete = () => {
    const selectedNodes = gridRef.current?.api.getSelectedNodes();
    if (!selectedNodes || selectedNodes.length === 0) return;

    if (window.confirm(`Are you sure you want to DELETE ${selectedNodes.length} record(s)?`)) {
      saveHistory();
      const selectedIds = new Set(selectedNodes.map(n => n.rowIndex));
      setRowData(prev => prev.filter((_, idx) => !selectedIds.has(idx)));
      setSelectedCable(null);
    }
  };

  const handleClear = () => {
    if (window.confirm("WARNING: This will delete ALL records in this project.\n\nAre you sure you want to CLEAR EVERYTHING?")) {
      saveHistory();
      setRowData([]);
      setSelectedCable(null);
    }
  };

  const handleSmartClone = useCallback(() => {
    if (!selectedCable) return;
    saveHistory();
    let nNum = incrementString(selectedCable.wireNumber || "W000");
    while (rowData.some(r => r.wireNumber === nNum)) { nNum = incrementString(nNum); }
    const nRec: WireRecord = {
      ...selectedCable, wireNumber: nNum,
      src_dev: selectedCable.src_dev ? incrementString(selectedCable.src_dev) : selectedCable.src_dev,
      dst_dev: selectedCable.dst_dev ? incrementString(selectedCable.dst_dev) : selectedCable.dst_dev
    };
    setRowData(prev => [nRec, ...prev]); 
  }, [selectedCable, rowData, saveHistory]);

  const handleSelectAll = (val: boolean) => {
    setShowSignal(val); setShowDwg(val); setShowLoc1(val); setShowLoc2(val);
    setShowConn(val); setShowPort(val); setShowLen(val); setShowCblType(val);
    setShowColor(val); setShowRemarks(val);
  };

  const isAllSelected = showSignal && showDwg && showLoc1 && showLoc2 && showConn && showPort && showLen && showCblType && showColor && showRemarks;

  const buildLabelLine = (side: 'A' | 'B', customData?: WireRecord) => {
    const s = customData || selectedCable;
    if (!s) return "";
    const loc1 = side === 'A' ? s.src_loc1 : s.dst_loc1;
    const loc2 = side === 'A' ? s.src_loc2 : s.dst_loc2;
    const dev = side === 'A' ? s.src_dev : s.dst_dev;
    const port = side === 'A' ? s.src_port : s.dst_port;
    return [s.wireNumber, printLoc1 ? loc1 : null, printLoc2 ? loc2 : null, dev, printPort ? port : null].filter(p => p).join(" ");
  };

  const getDynamicFontSize = (row: WireRecord) => {
    const lineA = buildLabelLine('A', row);
    const lineB = buildLabelLine('B', row);
    const maxLen = Math.max(lineA.length, lineB.length);
    
    if (maxLen > 40) return '7pt';
    if (maxLen > 34) return '8pt';
    if (maxLen > 28) return '9pt';
    if (maxLen > 22) return '10pt'; 
    if (maxLen > 18) return '12pt'; 
    return '14pt'; 
  };

  // --- UPDATED COLUMN DEFINITIONS (With Printable Highlight) ---
  const printableStyle = { backgroundColor: '#f0f0f0' };

  const colDefs = useMemo<(ColDef | ColGroupDef)[]>(() => [
    { field: "wireNumber", headerName: "WIRE#", width: 90, pinned: "left", cellStyle: printableStyle },
    { field: "signalType", headerName: "SIG", width: 80, hide: !showSignal, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: SIGNAL_TYPES } },
    {
      headerName: "A SIDE", headerClass: 'a-side-header',
      children: [
        { field: "src_dwg", headerName: "PAGE#", width: 75, hide: !showDwg },
        { field: "src_loc1", headerName: "LOC 1", width: 90, hide: !showLoc1, cellStyle: printableStyle },
        { field: "src_loc2", headerName: "LOC 2", width: 90, hide: !showLoc2, cellStyle: printableStyle },
        { field: "src_dev", headerName: "DEVICE", width: 120, cellStyle: printableStyle },
        { field: "src_conn", headerName: "CONN", width: 90, hide: !showConn },
        { field: "src_port", headerName: "PORT", width: 85, hide: !showPort, cellStyle: printableStyle },
      ]
    },
    {
      headerName: "B SIDE", headerClass: 'b-side-header',
      children: [
        { field: "dst_dwg", headerName: "PAGE#", width: 75, hide: !showDwg },
        { field: "dst_loc1", headerName: "LOC 1", width: 90, hide: !showLoc1, cellStyle: printableStyle },
        { field: "dst_loc2", headerName: "LOC 2", width: 90, hide: !showLoc2, cellStyle: printableStyle },
        { field: "dst_dev", headerName: "DEVICE", width: 120, cellStyle: printableStyle },
        { field: "dst_conn", headerName: "CONN", width: 90, hide: !showConn },
        { field: "dst_port", headerName: "PORT", width: 85, hide: !showPort, cellStyle: printableStyle },
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

      const startMarkerIdx = allRows.findIndex(row => String(row[0] || "").toUpperCase().includes("START"));
      const startIndex = startMarkerIdx !== -1 ? startMarkerIdx + 1 : 0;
      const stopMarkerIdx = allRows.findIndex(row => String(row[0] || "").toUpperCase().includes("STOP"));
      const endIndex = stopMarkerIdx !== -1 ? stopMarkerIdx : allRows.length;

      const validRows = allRows.slice(startIndex, endIndex);
      const trans: WireRecord[] = validRows.map((row): WireRecord | null => {
          if (!row[1]) return null;
          return {
            wireNumber: String(row[1]), signalType: row[2],
            src_dwg: row[3], src_loc1: row[4], src_loc2: row[5], src_dev: row[6], src_conn: row[7], src_port: row[8],
            dst_dwg: row[10], dst_loc1: row[11], dst_loc2: row[12], dst_dev: row[13], dst_conn: row[14], dst_port: row[15],
            wireType: row[16], len: row[17], color: row[18], remarks: row[19]
          };
        }).filter((r): r is WireRecord => r !== null);

      setRowData(prev => [...prev, ...trans]);
    };
    reader.readAsBinaryString(file);
    e.target.value = ""; 
  };

  const handleExport = () => {
    if (rowData.length === 0) { alert("No data to export."); return; }
    const ws = XLSX.utils.json_to_sheet(rowData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "WireList");
    XLSX.writeFile(wb, `${jobMeta.jobName || 'WireList'}.xlsx`);
  };

  const isExternalFilterPresent = useCallback(() => searchText !== "", [searchText]);
  const doesExternalFilterPass = useCallback((node: IRowNode<WireRecord>) => {
    if (!searchText || !node.data) return true;
    const fuzzy = new RegExp(searchText.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');
    return Object.values(node.data).some(val => fuzzy.test(String(val || "")));
  }, [searchText]);

  const getMrLabelPages = () => {
    const fullBatch: (WireRecord | null)[] = Array(startPos - 1).fill(null);
    rowData.forEach(row => {
      for(let i=0; i<qtyPerRecord; i++) fullBatch.push(row);
    });
    const pages: (WireRecord | null)[][] = [];
    for (let i = 0; i < fullBatch.length; i += 32) {
      pages.push(fullBatch.slice(i, i + 32));
    }
    return pages;
  };

  // --- GATEKEEPER / START SCREEN ---
  if (!isJobLoaded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#343a40', color: 'white', fontFamily: "Segoe UI, sans-serif" }}>
        <div style={{ background: '#fff', padding: '40px', borderRadius: '8px', color: '#333', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', width: '400px' }}>
          <h2 style={{ marginBottom: '20px' }}>CONNEKS Utility</h2>
          <p style={{ marginBottom: '25px', color: '#666', fontSize: '0.9rem' }}>Please enter Job Details to begin.</p>
          
          <div style={{display:'flex', flexDirection:'column', gap:'12px', textAlign:'left'}}>
            <div>
              <label style={{fontSize: '0.8rem', fontWeight:'bold', display:'block', marginBottom:'4px'}}>Job Name *</label>
              <input 
                type="text" 
                placeholder="e.g. Project-Alpha" 
                style={{ padding: '8px', fontSize: '1rem', width: '100%', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                value={jobMeta.jobName}
                onChange={(e) => setJobMeta({...jobMeta, jobName: e.target.value})}
              />
            </div>
            <div>
              <label style={{fontSize: '0.8rem', fontWeight:'bold', display:'block', marginBottom:'4px'}}>Job Number</label>
              <input 
                type="text" 
                placeholder="Optional" 
                style={{ padding: '8px', fontSize: '1rem', width: '100%', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                value={jobMeta.jobNumber}
                onChange={(e) => setJobMeta({...jobMeta, jobNumber: e.target.value})}
              />
            </div>
            <div>
              <label style={{fontSize: '0.8rem', fontWeight:'bold', display:'block', marginBottom:'4px'}}>Project Manager</label>
              <input 
                type="text" 
                placeholder="Optional" 
                style={{ padding: '8px', fontSize: '1rem', width: '100%', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                value={jobMeta.pm}
                onChange={(e) => setJobMeta({...jobMeta, pm: e.target.value})}
              />
            </div>
            <div>
              <label style={{fontSize: '0.8rem', fontWeight:'bold', display:'block', marginBottom:'4px'}}>Project Engineer</label>
              <input 
                type="text" 
                placeholder="Optional" 
                style={{ padding: '8px', fontSize: '1rem', width: '100%', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                value={jobMeta.pe}
                onChange={(e) => setJobMeta({...jobMeta, pe: e.target.value})}
                onKeyDown={(e) => { if(e.key === 'Enter') loadJob(); }}
              />
            </div>
          </div>
          
          <br />
          <button 
            className="btn btn-primary" 
            style={{ padding: '10px 30px', fontSize: '1rem', width: '100%', marginTop: '10px', textTransform: 'uppercase' }}
            onClick={loadJob}
            disabled={!jobMeta.jobName.trim()}
          >
            Open Job
          </button>
        </div>
      </div>
    );
  }

  // --- MAIN APP ---
  return (
    <>
      <style>{`
        html, body, #root { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; font-family: "Segoe UI", sans-serif; background-color: #f0f0f0; }
        .ag-theme-balham .ag-cell { border-right: none !important; border-bottom: 1px solid #d9d9d9 !important; text-align: center; } 
        .a-side-header { background-color: #A0CCFF !important; } .b-side-header { background-color: #B0FFB0 !important; } 
        
        .printable-area { 
          width: 100%; background: #fff; display: flex; flex-direction: column; justify-content: center; 
          padding: 5px 10px 5px 20px; 
          box-sizing: border-box; font-family: 'Consolas', monospace; font-weight: bold; 
          overflow: hidden; text-align: left;
        }
        .label-line { white-space: nowrap; overflow: hidden; line-height: 1.1; }

        .label-preview-container { 
          background-color: #fff; 
          border: 1px solid #000; 
          border-radius: 4px; 
          height: 90px; 
          overflow: hidden; 
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .sidebar-section { margin-bottom: 25px; }
        .sidebar-section h4 { border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; font-size: 0.95rem; color: #333; }
        .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer; margin-bottom: 8px; color: #444; }
        
        .btn { 
          padding: 6px 14px; 
          border-radius: 4px; 
          border: 1px solid #ccc; 
          cursor: pointer; 
          font-weight: 600; 
          font-size: 0.75rem; 
          transition: background 0.2s; 
          text-transform: uppercase; 
          letter-spacing: 0.5px;
        }
        .btn-primary { background-color: #007bff; color: white; border-color: #0069d9; }
        .btn-dark { background-color: #444; color: white; border: 1px solid #666; }
        .btn-danger { background-color: #dc3545; color: white; border-color: #bd2130; }
        .btn-success { background-color: #28a745; color: white; border-color: #218838; }

        .path-visualizer { 
          display: flex; align-items: center; justify-content: space-between; gap: 5px;
          background: #222; padding: 5px 15px; border-radius: 6px; border: 1px solid #444; 
          width: 380px; height: 40px; margin-left: 15px; 
        }
        .path-node { display: flex; flex-direction: column; align-items: center; min-width: 60px; }
        .node-label { font-size: 9px; color: #aaa; text-transform: uppercase; letter-spacing: 1px; }
        .node-value { font-size: 12px; color: #fff; font-weight: bold; }
        
        .path-line-container { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .path-line { flex: 1; height: 2px; background: #555; }
        .wire-badge { color: #f39c12; font-size: 12px; font-weight: 900; white-space: nowrap; }

        .dropdown { position: relative; display: inline-block; }
        .dropdown-content { display: none; position: absolute; left: 0; background-color: #fff; min-width: 160px; box-shadow: 0px 8px 16px rgba(0,0,0,0.2); z-index: 1000; border: 1px solid #ccc; border-radius: 4px; }
        .dropdown:hover .dropdown-content { display: block; }
        .dropdown-content button { width: 100%; padding: 10px; border: none; background: none; text-align: left; cursor: pointer; font-size: 0.85rem; }
        .example-label-wrapper { background: #fff; border: 2px dashed #bbb; padding: 30px; display: flex; gap: 20px; border-radius: 8px; margin-bottom: 20px; }
        .actual-label-stock { background: #fff; border: 1px solid #333; position: relative; display: flex; flex-direction: column; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .laminate-tail { width: 100%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 2px; }
        
        .sheet-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 15px; background: #e0e0e0; border: 2px solid #999; border-radius: 6px; width: 320px; }
        .sheet-cell { height: 45px; background: #fff; border: 1px solid #bbb; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999; border-radius: 2px; }
        .sheet-cell.selected { background: #007bff; color: white; border-color: #0056b3; font-weight: bold; }
        .sheet-cell.occupied { background: #d4edda; color: #155724; border-color: #c3e6cb; }

        .preview-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 2000; display: flex; flex-direction: column; }
        .preview-header { padding: 15px 40px; background: #333; color: #fff; display: flex; justify-content: space-between; align-items: center; }
        .preview-content { flex: 1; padding: 40px; overflow-y: auto; display: flex; flex-direction: column; align-items: center; gap: 30px; }
        
        @media print {
          body * { visibility: hidden; }
          #print-stage, #print-stage * { visibility: visible; }
          #print-stage { position: absolute; left: 0; top: 0; width: 100%; }
          @page { margin: 0; }
          .thermal-page { page-break-after: always; width: 2.0in; height: 2.25in; }
          .mrlabel-page { page-break-after: always; width: 8.5in; height: 11in; display: grid; grid-template-columns: repeat(4, 1in); grid-template-rows: repeat(8, 1in); gap: 0.1in; padding: 0.5in; box-sizing: border-box; }
        }
      `}</style>

      {isPreviewOpen && (
        <div className="preview-modal">
          <div className="preview-header">
            <div>
              <h3 style={{margin:0}}>Label Batch Preview</h3>
              <p style={{margin:0, fontSize: '0.8rem', opacity: 0.7}}>Checking {labelStock.toUpperCase()} Stock Layout.</p>
            </div>
            <div style={{display:'flex', gap: '10px'}}>
              <button className="btn btn-dark" onClick={() => setIsPreviewOpen(false)}>Cancel</button>
              <button className="btn btn-success" onClick={() => window.print()}>Send to Printer</button>
            </div>
          </div>
          <div className="preview-content">
            {/* ... Preview Logic ... */}
            {labelStock === 'thermal' ? (
              rowData.map((row, rIdx) => (
                <div key={rIdx} style={{display: 'flex', gap: '15px', borderBottom: '1px solid #444', paddingBottom: '20px', width: '100%', justifyContent: 'center'}}>
                  {Array.from({ length: qtyPerRecord }).map((_, qIdx) => (
                    <div key={qIdx} className="actual-label-stock" style={{ width: '200px', height: '225px', background: '#fff' }}>
                      <div className="printable-area" style={{ height: '33%', fontSize: getDynamicFontSize(row) }}>
                        <div className="label-line">{buildLabelLine('A', row)}</div>
                        <div className="label-line">{buildLabelLine('B', row)}</div>
                        <div className="label-line">{buildLabelLine('A', row)}</div>
                        <div className="label-line">{buildLabelLine('B', row)}</div>
                      </div>
                      <div className="laminate-tail" style={{ height: '67%', background: '#eee' }}></div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              getMrLabelPages().map((page, pIdx) => (
                <div key={pIdx} style={{ background: '#fff', width: '600px', height: '776px', padding: '40px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(8, 1fr)', gap: '10px', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
                  {page.map((row, cIdx) => (
                    <div key={cIdx} className="actual-label-stock" style={{ border: row ? '1px solid #333' : '1px dashed #ccc' }}>
                      {row && (
                        <div className="printable-area" style={{ height: '100%', border: 'none', padding: '5px', fontSize: getDynamicFontSize(row) }}>
                          <div className="label-line">{buildLabelLine('A', row)}</div>
                          <div className="label-line">{buildLabelLine('B', row)}</div>
                          <div className="label-line">{buildLabelLine('A', row)}</div>
                          <div className="label-line">{buildLabelLine('B', row)}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Hidden Print Stage */}
      <div id="print-stage" style={{ display: 'none' }}>
        {labelStock === 'thermal' ? (
          rowData.map((row, rIdx) => (
            Array.from({ length: qtyPerRecord }).map((_, qIdx) => (
              <div key={`${rIdx}-${qIdx}`} className="thermal-page">
                <div className="printable-area" style={{ height: '0.75in', fontSize: getDynamicFontSize(row) }}>
                  <div className="label-line">{buildLabelLine('A', row)}</div>
                  <div className="label-line">{buildLabelLine('B', row)}</div>
                  <div className="label-line">{buildLabelLine('A', row)}</div>
                  <div className="label-line">{buildLabelLine('B', row)}</div>
                </div>
              </div>
            ))
          ))
        ) : (
          getMrLabelPages().map((page, pIdx) => (
            <div key={pIdx} className="mrlabel-page">
              {page.map((row, cIdx) => (
                <div key={cIdx} className="printable-area" style={{ border: 'none', fontSize: row ? getDynamicFontSize(row) : '1pt' }}>
                  {row && (
                    <>
                      <div className="label-line">{buildLabelLine('A', row)}</div>
                      <div className="label-line">{buildLabelLine('B', row)}</div>
                      <div className="label-line">{buildLabelLine('A', row)}</div>
                      <div className="label-line">{buildLabelLine('B', row)}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Header */}
      <header style={{ height: '70px', backgroundColor: '#343a40', color: 'white', padding: '0 25px', display: 'flex', alignItems: 'center' }}>
        <div style={{display:'flex', alignItems:'center'}}>
          <h2 style={{ margin: 0, minWidth: '180px' }}>CONNEKS <span style={{fontWeight: '300', fontSize: '1.1rem', opacity: 0.8}}>Utility</span></h2>
          <div className="dropdown" style={{ marginLeft: '15px' }}>
            <button className="btn btn-dark">PRINT ▾</button>
            <div className="dropdown-content">
              <button onClick={() => setView('labels')}>PRINT LABELS</button>
              <button onClick={() => setView('runlist')}>PRINT RUN LIST</button>
            </div>
          </div>
        </div>

        {/* Path Visualizer */}
        <div className="path-visualizer">
          <div className="path-node">
            <span className="node-label">Source</span>
            <span className="node-value">{selectedCable?.src_dev || "---"}</span>
          </div>
          <div className="path-line-container">
            <div className="path-line"></div>
            <span className="wire-badge">{selectedCable ? selectedCable.wireNumber : "---"}</span>
            <div className="path-line"></div>
          </div>
          <div className="path-node">
            <span className="node-label">Destination</span>
            <span className="node-value">{selectedCable?.dst_dev || "---"}</span>
          </div>
        </div>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <h3 style={{ margin: 0, color: '#fff' }}>{jobMeta.jobName}</h3>
          {(jobMeta.jobNumber || jobMeta.pm) && (
            <div style={{ fontSize: '1rem', color: '#ccc', marginTop:'2px' }}>
              {jobMeta.jobNumber && <span>#{jobMeta.jobNumber}</span>}
              {jobMeta.jobNumber && jobMeta.pm && <span> | </span>}
              {jobMeta.pm && <span>PM: {jobMeta.pm}</span>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center' }}>
          {view === 'home' ? (
            <>
              <button className="btn btn-dark" onClick={handleUndo} disabled={history.length === 0}>Undo</button>
              <button className="btn btn-dark" onClick={handleRedo} disabled={future.length === 0}>Redo</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={!selectedCable}>Delete</button>
              <button className="btn btn-danger" onClick={handleClear} disabled={rowData.length === 0}>Clear</button>
              <button className="btn btn-primary" onClick={() => { saveHistory(); setRowData([{ wireNumber: `NEW-${rowData.length + 1}` }, ...rowData]); }}>+ Add</button>
              <button className="btn btn-success" onClick={handleSmartClone} disabled={!selectedCable}>Clone</button>
              <button className="btn btn-dark" onClick={() => fileRef.current?.click()}>Import</button>
              <button className="btn btn-dark" style={{background:'#6c757d', border:'none'}} onClick={handleExport}>Export</button>
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
               <h4>SEARCH</h4>
               <input 
                  style={{padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box'}} 
                  placeholder="Type to search..." 
                  value={searchText} 
                  onChange={e => { setSearchText(e.target.value); gridRef.current?.api.onFilterChanged(); }} 
               />
            </div>

            <div className="sidebar-section">
              <h4>Live Label Preview</h4>
              <div className="label-preview-container">
                {selectedCable ? (
                  <div className="printable-area" style={{border: 'none', fontSize: getDynamicFontSize(selectedCable)}}>
                    <div className="label-line">{buildLabelLine('A')}</div>
                    <div className="label-line">{buildLabelLine('B')}</div>
                    <div className="label-line">{buildLabelLine('A')}</div>
                    <div className="label-line">{buildLabelLine('B')}</div>
                  </div>
                ) : <div style={{color:'#aaa', textAlign: 'center'}}>Select a row...</div>}
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
              <label className="checkbox-label" style={{fontWeight: 'bold', color: '#007bff'}}>
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
          {/* ... Print View Sidebar (Unchanged) ... */}
          <aside style={{ width: '380px', background: '#fff', borderRight: '1px solid #ddd', padding: '25px', overflowY: 'auto' }}>
            <div className="sidebar-section">
              <h4>Label Settings</h4>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '0.8rem', color: '#666' }}>Label Stock</label>
                <select style={{ width: '100%', padding: '8px' }} value={labelStock} onChange={(e:any) => setLabelStock(e.target.value)}>
                  <option value="mrlabel">Mr-Label (8.5x11 Sheet)</option>
                  <option value="thermal">Thermal 2-Across Roll</option>
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '0.8rem', color: '#666' }}>Quantity per Record</label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                  <button className={`btn ${qtyPerRecord === 1 ? 'btn-primary' : ''}`} onClick={() => setQtyPerRecord(1)}>1</button>
                  <button className={`btn ${qtyPerRecord === 2 ? 'btn-primary' : ''}`} onClick={() => setQtyPerRecord(2)}>2</button>
                </div>
              </div>
            </div>

            {labelStock === 'mrlabel' && (
              <div className="sidebar-section">
                <h4>Sheet Mapping</h4>
                <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '10px' }}>Choose the first available label spot:</p>
                <div className="sheet-grid">
                  {Array.from({ length: 32 }, (_, i) => (
                    <div 
                      key={i} 
                      className={`sheet-cell ${startPos === i + 1 ? 'selected' : ''}`} 
                      onClick={() => setStartPos(i + 1)}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
          <main style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* ... Print Preview (Unchanged) ... */}
            {labelStock === 'thermal' ? (
              <div className="example-label-wrapper">
                 {Array.from({ length: qtyPerRecord }).map((_, i) => (
                   <div key={i} className="actual-label-stock" style={{ width: '200px', height: '225px' }}>
                      <div className="printable-area" style={{ height: '33%', fontSize: selectedCable ? getDynamicFontSize(selectedCable) : '10pt' }}>
                        <div className="label-line">{selectedCable ? buildLabelLine('A') : "SIDE A"}</div>
                        <div className="label-line">{selectedCable ? buildLabelLine('B') : "SIDE B"}</div>
                        <div className="label-line">{selectedCable ? buildLabelLine('A') : "SIDE A"}</div>
                        <div className="label-line">{selectedCable ? buildLabelLine('B') : "SIDE B"}</div>
                      </div>
                      <div className="laminate-tail" style={{ height: '67%', background: '#f9f9f9' }}></div>
                   </div>
                 ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div className="actual-label-stock" style={{ width: '240px', height: '110px', marginBottom: '30px' }}>
                  <div className="printable-area" style={{ height: '100%', border: 'none', fontSize: selectedCable ? getDynamicFontSize(selectedCable) : '10pt' }}>
                    <div className="label-line">{selectedCable ? buildLabelLine('A') : "PREVIEW"}</div>
                    <div className="label-line">{selectedCable ? buildLabelLine('B') : "PREVIEW"}</div>
                    <div className="label-line">{selectedCable ? buildLabelLine('A') : "PREVIEW"}</div>
                    <div className="label-line">{selectedCable ? buildLabelLine('B') : "PREVIEW"}</div>
                  </div>
                </div>
                <p style={{fontWeight:'bold'}}>Mr-Label Preview: Starting at Position {startPos}</p>
              </div>
            )}
            <button className="btn btn-success" style={{ marginTop: '20px', width: '240px' }} onClick={() => setIsPreviewOpen(true)}>Generate Print File</button>
          </main>
        </div>
      )}
    </>
  );
}