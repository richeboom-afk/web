export type WireRecord = {
  wireNumber: string;
  signalType?: string;

  // DEVICE A (Source)
  deviceA_dwg?: string;
  deviceA_room?: string;       // LOC A1
  deviceA_rack?: string;       // LOC A2
  deviceA_name?: string;
  deviceA_conn?: string;
  deviceA_port?: string;

  // DEVICE B (Destination)
  deviceB_dwg?: string;
  deviceB_room?: string;       // LOC B1
  deviceB_rack?: string;       // LOC B2
  deviceB_name?: string;
  deviceB_conn?: string;
  deviceB_port?: string;

  // DETAILS
  length?: string;
  wireType?: string;
  color?: string;
  tag1?: string;
  tag2?: string;
  tag3?: string;
  remarks?: string;
};

// Optional: Metadata for UI generation if needed later
export const DEFAULT_FIELDS: Array<{ key: keyof WireRecord; label: string; required?: boolean }> = [
  { key: "wireNumber", label: "WIRE #", required: true },
  { key: "signalType", label: "SIGNAL TYPE" },

  // Device A
  { key: "deviceA_dwg", label: "DEV A DWG" },
  { key: "deviceA_room", label: "LOC A1" },
  { key: "deviceA_rack", label: "LOC A2" },
  { key: "deviceA_name", label: "DEV A NAME", required: true },
  { key: "deviceA_conn", label: "DEV A CONN" },
  { key: "deviceA_port", label: "DEV A PORT" },

  // Device B
  { key: "deviceB_dwg", label: "DEV B DWG" },
  { key: "deviceB_room", label: "LOC B1" },
  { key: "deviceB_rack", label: "LOC B2" },
  { key: "deviceB_name", label: "DEV B NAME", required: true },
  { key: "deviceB_conn", label: "DEV B CONN" },
  { key: "deviceB_port", label: "DEV B PORT" },

  // Details
  { key: "length", label: "LENGTH" },
  { key: "wireType", label: "WIRE TYPE" },
  { key: "color", label: "COLOR" },
  { key: "tag1", label: "TAG 1" },
  { key: "tag2", label: "TAG 2" },
  { key: "tag3", label: "TAG 3" },
  { key: "remarks", label: "REMARKS" },
];