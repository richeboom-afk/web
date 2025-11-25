import { useState, useMemo, useRef, useEffect } from "react";
import { AgGridReact } from 'ag-grid-react';
import * as XLSX from "xlsx";

// --- AG GRID MODULES ---
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'; 
import type { ColDef, ColGroupDef } from 'ag-grid-community';
import "ag-grid-community/styles/ag-grid.css"; 
import "ag-grid-community/styles/ag-theme-balham.css"; 

ModuleRegistry.registerModules([ AllCommunityModule ]);

// --- STYLES ---
const SEPARATOR_STYLE = { borderRight: "3px solid #555" }; 

// --- CUSTOM CSS OVERRIDES ---
const GRID_STYLES = `
  /* Vertical lines between all cells */
  .ag-theme-balham .ag-cell {
    border-right: 1px solid #d9d9d9 !important;
  }
  .ag-theme-balham .ag-header-cell {
    border-right: 1px solid #d9d9d9 !important;
  }
  
  /* HIDE ALL HEADER ICONS (Filter funnels, Menu bars, Sort arrows) */
  .ag-icon, .ag-header-icon, .ag-icon-menu, .ag-icon-filter {
    display: none !important;
  }
  
  /* Center the Group Headers */
  .ag-header-group-cell-label {
    justify-content: center;
    font-weight: bold;
    font-size: 14px;
  }
`;

// --- TYPES ---
type WireRecord = {
  signalType?: string;
  // A SIDE
  src_dwg?: string;
  src_loc1?: string;
  src_loc2?: string;
  src_dev?: string;
  src_conn?: string;
  src_port?: string;
  // B SIDE
  dst_dwg?: string;
  dst_loc1?: string;
  dst_loc2?: string;
  dst_dev?: string;
  dst_conn?: string;
  dst_port?: string;
  // INFO
  remarks?: string;
  wireType?: string;
  len?: string;
  tag1?: string;
  tag2?: string;
  tag3?: string;
  wireNumber?: string;
  wo?: string;
};

const STORAGE_KEY = "wirelisting.pro.v3";

const headerToKey = new Map<string, keyof WireRecord>([
  ["signal type", "signalType"],
  // A SIDE
  ["dwg a", "src_dwg"], 
  ["location 1 (a)", "src_loc1"], ["location 1(a)", "src_loc1"],
  ["location 2 (a)", "src_loc2"], ["location 2(a)", "src_loc2"],
  ["device (a)", "src_dev"], ["device(a)", "src_dev"],
  ["connector (a)", "src_conn"], ["connector(a)", "src_conn"],
  ["port (a)", "src_port"], ["port(a)", "src_port"],
  // B SIDE
  ["dwg b", "dst_dwg"], 
  ["location 1 (b)", "dst_loc1"], ["location 1(b)", "dst_loc1"],
  ["location 2 (b)", "dst_loc2"], ["location 2(b)", "dst_loc2"],
  ["device (b)", "dst_dev"], ["device(b)", "dst_dev"],
  ["connector (b)", "dst_conn"], ["connector(b)", "dst_conn"],
  ["port (b)", "dst_port"], ["port(b)", "dst_port"],
  // OTHERS
  ["remarks", "remarks"],
  ["type", "wireType"], ["wire type", "wireType"],
  ["length", "len"],
  ["tag 1", "tag1"],
  ["tag 2", "tag2"],
  ["tag 3", "tag3"],
]);

const emptyRow = (): WireRecord => ({
  signalType: "",
  src_dwg: "", src_loc1: "", src_loc2: "", src_dev: "", src_conn: "", src_port: "",
  dst_dwg: "", dst_loc1: "", dst_loc2: "", dst_dev: "", dst_conn: "", dst_port: "",
  remarks: "", wireType: "", len: "", tag1: "", tag2: "", tag3: ""
});

export default function App() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rowData, setRowData] = useState<WireRecord[]>([]);
  const [quickFilterText, setQuickFilterText] = useState<string>(""); 
  
  // --- COLUMN VISIBILITY STATE ---
  const [showDwg, setShowDwg] = useState(true);
  const [showLoc, setShowLoc] = useState(true);
  const [showPort, setShowPort] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setRowData(JSON.parse(saved));
    } catch (e) { console.error("Load error", e); }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rowData));
  }, [rowData]);

  const colDefs = useMemo<(ColDef | ColGroupDef)[]>(() => [
    { field: "signalType", headerName: "SIGNAL TYPE", width: 120, pinned: "left", filter: false },

    // A SIDE
    {
      headerName: "A SIDE",
      marryChildren: true,
      children: [
        { field: "src_dwg", headerName: "DWG A", width: 80, hide: !showDwg },
        { field: "src_loc1", headerName: "LOCATION 1 (A)", width: 120, hide: !showLoc },
        { field: "src_loc2", headerName: "LOCATION 2 (A)", width: 120, hide: !showLoc },
        { field: "src_dev", headerName: "DEVICE (A)", width: 150 },
        { field: "src_conn", headerName: "CONNECTOR (A)", width: 130 },
        { field: "src_port", headerName: "PORT (A)", width: 100, hide: !showPort, cellStyle: SEPARATOR_STYLE },
      ]
    },

    // B SIDE
    {
      headerName: "B SIDE",
      marryChildren: true,
      children: [
        { field: "dst_dwg", headerName: "DWG B", width: 80, hide: !showDwg },
        { field: "dst_loc1", headerName: "LOCATION 1 (B)", width: 120, hide: !showLoc },
        { field: "dst_loc2", headerName: "LOCATION 2 (B)", width: 120, hide: !showLoc },
        { field: "dst_dev", headerName: "DEVICE (B)", width: 150 },
        { field: "dst_conn", headerName: "CONNECTOR (B)", width: 130 },
        { field: "dst_port", headerName: "PORT (B)", width: 100, hide: !showPort },
      ]
    },

    // INFO
    { field: "remarks", headerName: "REMARKS", width: 150 },
    { field: "wireType", headerName: "TYPE", width: 100 },
    { field: "len", headerName: "LENGTH", width: 80 },
    { field: "tag1", headerName: "Tag 1", width: 80 },
    { field: "tag2", headerName: "Tag 2", width: 80 },
    { field: "tag3", headerName: "Tag 3", width: 80 },

  ], [showDwg, showLoc, showPort]); // Re-render when toggles change

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
      const translatedData = rawData.map(row => {
        const newRow: any = {};
        for (const [excelKey, value] of Object.entries(row)) {
          const appKey = headerToKey.get(excelKey.trim().toLowerCase());
          if (appKey) newRow[appKey] = value;
        }
        return newRow;
      });
      setRowData(prev => [...prev, ...translatedData]);
    };
    reader.readAsBinaryString(file);
    e.target.value = ""; 
  };

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rowData);
    XLSX.utils.book_append_sheet(wb, ws, "WireList");
    XLSX.writeFile(wb, "WireList_Export.xlsx");
  };

  const addRow = () => {
    setRowData(prev => [emptyRow(), ...prev]);
  };

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", fontFamily: "Segoe UI, sans-serif" }}>
      
      <style>{GRID_STYLES}</style>

      {/* LEFT SIDEBAR (15%) */}
      <div style={{ width: "15%", background: "#e8e8e8", borderRight: "1px solid #ccc", padding: "15px", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
        
        {/* Toggle Section */}
        <div style={{ marginBottom: "20px", background: "#fff", padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#333", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>Display Options</h4>
          
          <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
            <input type="checkbox" checked={showDwg} onChange={e => setShowDwg(e.target.checked)} style={{ transform: "scale(1.2)", marginRight: "8px" }} />
            <label onClick={() => setShowDwg(!showDwg)} style={{ cursor: "pointer", fontSize: "14px" }}>Show Drawings</label>
          </div>

          <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
            <input type="checkbox" checked={showLoc} onChange={e => setShowLoc(e.target.checked)} style={{ transform: "scale(1.2)", marginRight: "8px" }} />
            <label onClick={() => setShowLoc(!showLoc)} style={{ cursor: "pointer", fontSize: "14px" }}>Show Locations</label>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <input type="checkbox" checked={showPort} onChange={e => setShowPort(e.target.checked)} style={{ transform: "scale(1.2)", marginRight: "8px" }} />
            <label onClick={() => setShowPort(!showPort)} style={{ cursor: "pointer", fontSize: "14px" }}>Show Ports</label>
          </div>
        </div>

        {/* Future Stats Section */}
        <div style={{ background: "#fff", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", flex: 1 }}>
           <h4 style={{ margin: "0 0 10px 0", color: "#333", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>Stats</h4>
           <div style={{ fontSize: "13px", color: "#666" }}>
             Total Cables: <strong>{rowData.length}</strong>
           </div>
        </div>

      </div>

      {/* RIGHT CONTENT (85%) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        
        {/* Toolbar */}
        <div style={{ padding: "12px", background: "#ffffff", borderBottom: "1px solid #ddd", display: "flex", gap: "10px", alignItems: "center" }}>
          <h2 style={{ margin: 0, marginRight: "15px", fontSize: "18px", color: "#333" }}>Wire Manager</h2>
          <input 
            type="text" 
            placeholder="Search..." 
            style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc", width: "250px" }}
            onChange={(e) => setQuickFilterText(e.target.value)}
          />
          <div style={{ flex: 1 }}></div>
          <button onClick={addRow} style={{ padding: "6px 12px", cursor: "pointer" }}>+ Add</button>
          <button onClick={handleExport} style={{ padding: "6px 12px", cursor: "pointer" }}>Export</button>
          <button onClick={() => fileRef.current?.click()} style={{ padding: "6px 12px", cursor: "pointer", background: "#4CAF50", color: "white", border: "none" }}>Import</button>
          <button onClick={() => setRowData([])} style={{ padding: "6px 12px", cursor: "pointer", background: "#fee", color: "red", border: "1px solid red" }}>Clear</button>
          <input type="file" ref={fileRef} style={{display:'none'}} onChange={handleFileUpload} />
        </div>

        {/* The Grid */}
        <div className="ag-theme-balham" style={{ flex: 1, width: "100%" }}>
          <AgGridReact
            rowData={rowData}
            columnDefs={colDefs}
            quickFilterText={quickFilterText}
            defaultColDef={{
              sortable: true,
              filter: false, // Explicitly disable filtering on columns (we have the global search)
              resizable: true,
              editable: true,
            }}
          />
        </div>
      </div>

    </div>
  );
}