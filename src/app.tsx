import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { AgGridReact } from 'ag-grid-react';
import * as XLSX from "xlsx";
import type { WireRecord } from "./types"; // FIXED: Added 'type' keyword here

// --- AG GRID MODULES ---
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'; 
import type { ColDef, ColGroupDef, RowSelectedEvent } from 'ag-grid-community';

import "ag-grid-community/styles/ag-grid.css"; 
import "ag-grid-community/styles/ag-theme-balham.css"; 

ModuleRegistry.registerModules([ AllCommunityModule ]);

// --- REFERENCE LISTS ---
const SIGNAL_TYPES = ['VID', 'AUD', 'CTRL', 'DATA', 'POWER', 'RF', 'FIBER', 'OTHER'];
const CONNECTOR_TYPES = ['RJ45', 'HDMI', 'XLR-M', 'XLR-F', 'VGA', 'USB', 'SC/APC', 'LC/PC', 'DVI', 'N/A'];

// --- STYLES & OVERRIDES ---
const GRID_STYLES = `
  /* RESET & BASE LAYOUT */
  html, body, #root { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; font-family: "Segoe UI", sans-serif; background-color: #fff; }
  
  /* LAYOUT STRUCTURE */
  .app-container { display: flex; height: 100vh; width: 100vw; overflow: hidden; }
  
  /* SIDEBAR */
  .sidebar { 
    width: 300px; 
    background-color: #f9f9f9; 
    color: #333; 
    display: flex; 
    flex-direction: column; 
    padding: 15px; 
    overflow-y: auto; 
    flex-shrink: 0; 
    border-right: 1px solid #ccc;
  }

  .sidebar h3 { 
    margin-top: 0; 
    margin-bottom: 10px; 
    font-size: 1rem; 
    color: #333; 
    font-weight: bold;
    border-bottom: 2px solid #ddd;
    padding-bottom: 5px;
  }
  
  .sidebar-section { margin-bottom: 25px; }
  
  /* CUSTOM CHECKBOXES */
  .checkbox-label { display: flex; align-items: center; margin-bottom: 6px; cursor: pointer; font-size: 0.9rem; color: #444; }
  .checkbox-label input { margin-right: 8px; } 

  /* PREVIEW BOX (Fixed Aspect Ratio) */
  .preview-box {
    background-color: #fff;
    padding: 10px;
    border: 1px solid #000; 
    font-family: 'Consolas', 'Courier New', monospace;
    white-space: pre; 
    font-size: 12px;
    font-weight: bold;
    color: #000;
    box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
    
    /* Fixed Dimensions to simulate physical label */
    width: 260px;
    height: 100px;
    overflow: hidden; 
    line-height: 1.5;
  }

  /* --- HEADER (Light Gray) --- */
  .main-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    padding: 10px 15px; 
    background-color: #f4f4f4; 
    border-bottom: 1px solid #ccc;
    color: #333; 
  }
  .header-title { font-size: 1.2rem; margin: 0; font-weight: bold; color: #333; }
  .header-actions { display: flex; gap: 8px; }
  .search-input { padding: 5px 10px; border: 1px solid #ccc; border-radius: 3px; width: 200px; }

  /* BUTTONS */
  .btn { padding: 5px 12px; border: 1px solid #ccc; border-radius: 3px; cursor: pointer; font-size: 0.85rem; font-weight: 600; }
  .btn-primary { background-color: #0078d4; color: white; border-color: #0078d4; } .btn-primary:hover { background-color: #005a9e; }
  .btn-success { background-color: #fff; color: #333; } .btn-success:hover { background-color: #e0e0e0; }
  .btn-danger { background-color: #d9534f; color: white; border-color: #d43f3a; } .btn-danger:hover { background-color: #c9302c; }
  .btn-secondary { background-color: #fff; color: #333; } .btn-secondary:hover { background-color: #e0e0e0; }

  /* AG-GRID OVERRIDES */
  .ag-theme-balham { height: 100%; width: 100%; }
  .ag-root-wrapper { border: none; }
  .a-side-header { background-color: #bbdefb !important; color: #000; }
  .b-side-header { background-color: #c8e6c9 !important; color: #000; }
  .ag-header-cell-label { justify-content: center; }

  /* --- HIDE COLUMN MENU ICONS --- */
  .ag-header-icon { display: none !important; }
  .ag-icon { display: none !important; }
`;

// --- CONSTANTS ---
const STORAGE_KEY = "conneks.data.v1";

const emptyRow = (): WireRecord => ({
  wireNumber: "NEW-001", 
  signalType: "", 
  deviceA_dwg: "", deviceA_room: "", deviceA_rack: "", deviceA_name: "", deviceA_conn: "", deviceA_port: "",
  deviceB_dwg: "", deviceB_room: "", deviceB_rack: "", deviceB_name: "", deviceB_conn: "", deviceB_port: "",
  remarks: "", wireType: "", length: "", tag1: "", tag2: "", tag3: "", color: "",
});

export default function App() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rowData, setRowData] = useState<WireRecord[]>([]);
  const [quickFilterText, setQuickFilterText] = useState<string>(""); 
  const [selectedCable, setSelectedCable] = useState<WireRecord | null>(null);

  // LABEL PRINT OPTIONS
  const [printLoc1, setPrintLoc1] = useState(true);
  const [printLoc2, setPrintLoc2] = useState(true);
  const [printPort, setPrintPort] = useState(true);

  // COLUMN TOGGLES
  const [showSignal, setShowSignal] = useState(true);
  const [showDwg, setShowDwg] = useState(true);
  const [showLoc1, setShowLoc1] = useState(true); 
  const [showLoc2, setShowLoc2] = useState(true); 
  const [showPort, setShowPort] = useState(true);
  const [showLen, setShowLen] = useState(true);
  const [showCblType, setShowCblType] = useState(true);
  const [showTag1, setShowTag1] = useState(true);
  const [showTag2, setShowTag2] = useState(true);
  const [showTag3, setShowTag3] = useState(true);
  const [showColor, setShowColor] = useState(true);
  const [showRemarks, setShowRemarks] = useState(true);
  
  const gridRef = useRef<AgGridReact<WireRecord>>(null); 

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setRowData(JSON.parse(saved));
    } catch (e) { console.error("Load error", e); }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rowData));
  }, [rowData]);

  // --- COLUMN DEFINITIONS ---
  const colDefs = useMemo<(ColDef | ColGroupDef)[]>(() => [
    { field: "wireNumber", headerName: "WIRE#", width: 90, pinned: "left", filter: false, cellStyle: { fontWeight: 'bold', textAlign: 'center' } },
    { 
      field: "signalType", 
      headerName: "SIG", 
      width: 80, 
      hide: !showSignal, 
      editable: true, 
      cellEditor: 'agSelectCellEditor', 
      cellEditorParams: { values: SIGNAL_TYPES } 
    },
    {
      headerName: "A SIDE", marryChildren: true, headerClass: 'a-side-header',
      children: [
        { field: "deviceA_dwg", headerName: "PAGE#", width: 70, hide: !showDwg }, 
        { field: "deviceA_room", headerName: "LOCATION 1", width: 100, hide: !showLoc1 },
        { field: "deviceA_rack", headerName: "LOCATION 2", width: 100, hide: !showLoc2 },
        { field: "deviceA_name", headerName: "DEVICE", width: 120, editable: true },
        { field: "deviceA_conn", headerName: "CONNECTOR", width: 100, editable: true, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: CONNECTOR_TYPES } },
        { field: "deviceA_port", headerName: "PORT", width: 90, hide: !showPort }, 
      ]
    },
    {
      headerName: "B SIDE", marryChildren: true, headerClass: 'b-side-header',
      children: [
        { field: "deviceB_dwg", headerName: "PAGE#", width: 70, hide: !showDwg }, 
        { field: "deviceB_room", headerName: "LOCATION 1", width: 100, hide: !showLoc1 },
        { field: "deviceB_rack", headerName: "LOCATION 2", width: 100, hide: !showLoc2 },
        { field: "deviceB_name", headerName: "DEVICE", width: 120, editable: true },
        { field: "deviceB_conn", headerName: "CONNECTOR", width: 100, editable: true, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: CONNECTOR_TYPES } },
        { field: "deviceB_port", headerName: "PORT", width: 90, hide: !showPort },
      ]
    },
    { field: "length", headerName: "LEN", width: 70, hide: !showLen },
    { field: "wireType", headerName: "CBL TYPE", width: 100, hide: !showCblType },
    { field: "color", headerName: "COLOR", width: 80, hide: !showColor },
    { field: "remarks", headerName: "RMRKS", width: 120, hide: !showRemarks },
    { field: "tag1", headerName: "TAG 1", width: 80, hide: !showTag1 },
    { field: "tag2", headerName: "TAG 2", width: 80, hide: !showTag2 },
    { field: "tag3", headerName: "TAG 3", width: 80, hide: !showTag3 },
  ], [showSignal, showDwg, showLoc1, showLoc2, showPort, showLen, showCblType, showColor, showRemarks, showTag1, showTag2, showTag3]);

  // --- ACTIONS ---
  const handleAddNew = () => {
    const newRecord = { ...emptyRow(), wireNumber: `C-${1000 + rowData.length + 1}` };
    setRowData([...rowData, newRecord]);
  };
  
  const handleDelete = () => {
    const selectedData = gridRef.current?.api.getSelectedRows();
    if (!selectedData || selectedData.length === 0) return;
    const selectedWireNum = selectedData[0].wireNumber;
    setRowData(rowData.filter(row => row.wireNumber !== selectedWireNum));
    setSelectedCable(null);
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to delete all records?")) {
      setRowData([]);
      setSelectedCable(null);
    }
  };

  const onSelectionChanged = useCallback((event: RowSelectedEvent) => {
    const rows = event.api.getSelectedRows();
    setSelectedCable(rows && rows.length > 0 ? rows[0] : null);
  }, []);

  // --- EXCEL IMPORT/EXPORT ---
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(rowData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "WireList");
    XLSX.writeFile(wb, "CableSchedule.xlsx");
  };

  const importExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    
    // Use ArrayBuffer for better Excel support
    reader.readAsArrayBuffer(file);
    
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      // Skip Header Row (Index 0) and Map Columns by Index
      const mappedData: WireRecord[] = data.slice(1).map((row) => ({
        wireNumber:    row[0] || "",
        signalType:    row[1] || "",
        deviceA_dwg:   row[2] || "",
        deviceA_room:  row[3] || "",
        deviceA_rack:  row[4] || "",
        deviceA_name:  row[5] || "",
        deviceA_conn:  row[6] || "",
        deviceA_port:  row[7] || "",
        // SKIPPING INDEX 8 (Column I) if unused
        deviceB_dwg:   row[9] || "",
        deviceB_room:  row[10] || "",
        deviceB_rack:  row[11] || "",
        deviceB_name:  row[12] || "",
        deviceB_conn:  row[13] || "",
        deviceB_port:  row[14] || "",
        length:        row[15] || "",
        wireType:      row[16] || "",
        color:         row[17] || "",
        remarks:       row[18] || "",
        tag1:          row[19] || "",
        tag2:          row[20] || "",
        tag3:          row[21] || "",
      })).filter(r => r.wireNumber); 

      setRowData(mappedData);
    };
  };

  // --- PREVIEW GENERATION LOGIC ---
  const getPreviewText = () => {
    if (!selectedCable) return "Select a cable to preview.";
    const s = selectedCable;
    
    const buildLine = (loc1: string | undefined, loc2: string | undefined, dev: string | undefined, conn: string | undefined, port: string | undefined) => {
      const parts = [];
      if (printLoc1 && loc1) parts.push(loc1);
      if (printLoc2 && loc2) parts.push(loc2);
      if (dev) parts.push(dev);
      if (printPort) {
        if (conn) parts.push(conn);
        if (port) parts.push(port);
      }
      return parts.join(" ");
    };

    // Updated to use deviceA_ / deviceB_ keys
    const lineA = buildLine(s.deviceA_room, s.deviceA_rack, s.deviceA_name, s.deviceA_conn, s.deviceA_port);
    const lineB = buildLine(s.deviceB_room, s.deviceB_rack, s.deviceB_name, s.deviceB_conn, s.deviceB_port);

    // 4 Lines: A / B / A / B
    return `${lineA}\n${lineB}\n${lineA}\n${lineB}`;
  };

  return (
    <div className="app-container">
      <style>{GRID_STYLES}</style>
      
      {/* --- LEFT SIDEBAR --- */}
      <div className="sidebar">
        <div className="sidebar-section">
          <h3>Live Label Preview</h3>
          <div className="preview-box">{getPreviewText()}</div>
        </div>

        <div className="sidebar-section">
          <h3>Label Print Options</h3>
          <label className="checkbox-label"><input type="checkbox" checked={printLoc1} onChange={() => setPrintLoc1(!printLoc1)} /> Location 1</label>
          <label className="checkbox-label"><input type="checkbox" checked={printLoc2} onChange={() => setPrintLoc2(!printLoc2)} /> Location 2</label>
          <label className="checkbox-label"><input type="checkbox" checked={printPort} onChange={() => setPrintPort(!printPort)} /> Port</label>
        </div>

        <div className="sidebar-section">
          <h3>Show / Hide Columns</h3>
          <label className="checkbox-label"><input type="checkbox" checked={showSignal} onChange={() => setShowSignal(!showSignal)} /> Signal</label>
          <label className="checkbox-label"><input type="checkbox" checked={showDwg} onChange={() => setShowDwg(!showDwg)} /> Page #</label>
          <label className="checkbox-label"><input type="checkbox" checked={showLoc1} onChange={() => setShowLoc1(!showLoc1)} /> Location 1</label>
          <label className="checkbox-label"><input type="checkbox" checked={showLoc2} onChange={() => setShowLoc2(!showLoc2)} /> Location 2</label>
          <label className="checkbox-label"><input type="checkbox" checked={showPort} onChange={() => setShowPort(!showPort)} /> Ports</label>
          <label className="checkbox-label"><input type="checkbox" checked={showLen} onChange={() => setShowLen(!showLen)} /> Length</label>
          <label className="checkbox-label"><input type="checkbox" checked={showCblType} onChange={() => setShowCblType(!showCblType)} /> Cable Type</label>
          <label className="checkbox-label"><input type="checkbox" checked={showColor} onChange={() => setShowColor(!showColor)} /> Color</label>
          <label className="checkbox-label"><input type="checkbox" checked={showRemarks} onChange={() => setShowRemarks(!showRemarks)} /> Remarks</label>
          <label className="checkbox-label"><input type="checkbox" checked={showTag1} onChange={() => setShowTag1(!showTag1)} /> Tag 1</label>
          <label className="checkbox-label"><input type="checkbox" checked={showTag2} onChange={() => setShowTag2(!showTag2)} /> Tag 2</label>
          <label className="checkbox-label"><input type="checkbox" checked={showTag3} onChange={() => setShowTag3(!showTag3)} /> Tag 3</label>
        </div>
        
        <div className="sidebar-section" style={{ marginTop: 'auto' }}>
          <h3>Stats</h3>
          <div style={{ fontSize: '0.9rem', color: '#666' }}>Total Cables: {rowData.length}</div>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="main-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="main-header">
          <h2 className="header-title">CONNEKS <span style={{fontWeight: 'normal', fontSize: '1rem', opacity: 0.8}}>Cable Management Utility</span></h2>
          <div className="header-actions">
            <input type="text" placeholder="Search..." className="search-input" onChange={(e) => setQuickFilterText(e.target.value)} />
            <button className="btn btn-primary" onClick={handleAddNew}>+ Add</button>
            <button className="btn btn-success" onClick={exportExcel}>Export</button>
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>Import</button>
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            <button className="btn btn-danger" onClick={handleClearAll}>Clear</button>
            <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={importExcel} accept=".xlsx, .xls, .csv" />
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div className="ag-theme-balham" style={{ height: '100%', width: '100%' }}>
            <AgGridReact
              ref={gridRef}
              rowData={rowData}
              columnDefs={colDefs}
              defaultColDef={{ 
                resizable: true, 
                sortable: true, 
                filter: true
              }}
              rowSelection="single"
              onRowSelected={onSelectionChanged}
              quickFilterText={quickFilterText}
              animateRows={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}