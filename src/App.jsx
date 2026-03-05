import React, { useState, useRef, useCallback, useEffect } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STANZE = [
  "1.1 Grignolino","1.2 Barbera","1.3 Moscato",
  "2.1 Ruché","2.2 Freisa","2.3 Malvasia"
];

const NAZIONALITA_MAP = {
  "ITALIA":"100000100","GERMANIA":"100000276","FRANCIA":"100000250",
  "REGNO UNITO":"100000826","SPAGNA":"100000724","STATI UNITI":"100000840",
  "SVIZZERA":"100000756","AUSTRIA":"100000040","BELGIO":"100000056",
  "OLANDA":"100000528","RUSSIA":"100000643","CINA":"100000156",
  "GIAPPONE":"100000392","BRASILE":"100000076","ARGENTINA":"100000032",
};
const TIPO_DOC_MAP = { "CARTA D'IDENTITÀ":"CI","PASSAPORTO":"PP","PATENTE":"PD" };
const ISTAT_HEADERS = "COGNOME;NOME;SESSO;DATA_NASCITA;COMUNE_NASCITA;PROVINCIA_NASCITA;STATO_NASCITA;CITTADINANZA;TIPO_DOCUMENTO;NUMERO_DOCUMENTO;LUOGO_RILASCIO;DATA_ARRIVO;DATA_PARTENZA;NUM_PERNOTTAMENTI;STANZA;RUOLO";

const MONTHS_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const today = () => new Date().toISOString().split("T")[0];

const emptyPerson = () => ({
  _pid: Date.now().toString(36) + Math.random().toString(36).slice(2),
  cognome:"", nome:"", sesso:"M", dataNascita:"", comuneNascita:"",
  provinciaNascita:"", statoNascita:"ITALIA", cittadinanza:"ITALIA",
  tipoDoc:"CARTA D'IDENTITÀ", numDoc:"", luogoRilascio:""
});

const emptyBooking = () => ({
  id: Date.now().toString(),
  stanza: STANZE[0],
  dataArrivo: today(),
  dataPartenza:"",
  numPernottamenti:"1",
  guests:[emptyPerson()],
  createdAt: new Date().toISOString()
});

// ─── CONFLICT CHECK ───────────────────────────────────────────────────────────
// Returns the conflicting booking if the room is already occupied in the period, else null.
// Two stays overlap if arrivo1 < partenza2 AND arrivo2 < partenza1.
// If dataPartenza is empty we treat it as open-end (far future).
function findConflict(bookings, newBooking) {
  const FAR = "9999-12-31";
  const newIn  = newBooking.dataArrivo   || FAR;
  const newOut = newBooking.dataPartenza || FAR;
  return bookings.find(b => {
    if (b.id === newBooking.id) return false;         // same booking (edit mode)
    if (b.stanza !== newBooking.stanza) return false; // different room
    const bIn  = b.dataArrivo   || FAR;
    const bOut = b.dataPartenza || FAR;
    return newIn < bOut && bIn < newOut;              // date overlap
  }) || null;
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const DB_KEY = "checkin-bookings-v3";
async function loadBookings() {
  try { const r = await window.storage.get(DB_KEY); return r ? JSON.parse(r.value) : []; }
  catch { return []; }
}
async function saveBookings(bks) {
  try { await window.storage.set(DB_KEY, JSON.stringify(bks)); }
  catch(e) { console.error(e); }
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
function alloggiatiLine(person, booking, isCapo) {
  const pad = (s,n) => String(s||"").substring(0,n).padEnd(n);
  const dfmt = d => d ? d.replace(/-/g,"") : "        ";
  const codNaz = NAZIONALITA_MAP[person.statoNascita?.toUpperCase()] || "100000100";
  const codCit = NAZIONALITA_MAP[person.cittadinanza?.toUpperCase()] || "100000100";
  const tipo = TIPO_DOC_MAP[person.tipoDoc] || "CI";
  return (isCapo?"20":"21") +
    pad(person.cognome,50)+pad(person.nome,30)+
    (person.sesso==="M"?"1":"2")+dfmt(person.dataNascita)+
    pad(person.comuneNascita,9)+pad(person.provinciaNascita,2)+
    pad(codNaz,9)+pad(codCit,9)+
    tipo+pad(person.numDoc,20)+pad(person.luogoRilascio,9)+
    dfmt(booking.dataArrivo)+pad(booking.numPernottamenti,2);
}

function istatRow(person, booking, isCapo) {
  const d = s => s ? s.split("-").reverse().join("/") : "";
  return [
    person.cognome,person.nome,person.sesso,d(person.dataNascita),
    person.comuneNascita,person.provinciaNascita,person.statoNascita,person.cittadinanza,
    person.tipoDoc,person.numDoc,person.luogoRilascio,
    d(booking.dataArrivo),d(booking.dataPartenza),
    booking.numPernottamenti,booking.stanza,
    isCapo?"Capogruppo":"Accompagnatore"
  ].join(";");
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content],{type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  brown:"#8B5E3C", dark:"#2e2318", mid:"#6b5a4a",
  light:"#f5f0e8", cream:"#faf8f5", border:"#e2d8cc",
  green:"#4a7a4a", blue:"#4a5e7a", red:"#b04040",
  muted:"#9b8472", faint:"#c4b8a8",
  wine:"#6b2d3e",  // accent for export
};

const cardStyle = { background:"#fff", borderRadius:14, padding:22, boxShadow:"0 1px 18px rgba(46,35,24,0.09)" };

const Btn = ({ children, onClick, color=C.brown, textColor="#fff", outline=false, full=false, small=false, disabled=false, style:extra={} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: outline ? "transparent" : (disabled ? "#ccc" : color),
    color: outline ? color : textColor,
    border: outline ? `1.5px solid ${color}` : "none",
    borderRadius:8, padding: small ? "7px 14px" : "11px 20px",
    fontFamily:"'Cormorant Garamond', serif", fontSize: small ? 14 : 16,
    cursor: disabled ? "not-allowed" : "pointer", letterSpacing:"0.03em",
    width: full ? "100%" : undefined, opacity: disabled ? 0.6 : 1,
    transition:"opacity 0.2s", ...extra
  }}>{children}</button>
);

function Field({ label, value, onChange, type="text", options, span }) {
  const s = { width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, borderRadius:7, fontFamily:"'Crimson Pro', serif", fontSize:15, background:C.cream, color:C.dark, outline:"none", boxSizing:"border-box" };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4, gridColumn:span?"span 2":undefined }}>
      <label style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.12em", color:C.muted, fontFamily:"sans-serif" }}>{label}</label>
      {options
        ? <select value={value} onChange={e=>onChange(e.target.value)} style={s}>{options.map(o=><option key={o}>{o}</option>)}</select>
        : <input type={type} value={value} onChange={e=>onChange(e.target.value)} style={s} />}
    </div>
  );
}

function Spinner({ label="OCR in corso… (20-30 sec)" }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 0" }}>
      <div style={{ width:28, height:28, border:`2.5px solid ${C.border}`, borderTopColor:C.brown, borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0 }} />
      <span style={{ color:C.brown, fontFamily:"'Cormorant Garamond', serif", fontSize:16 }}>{label}</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── PERSON CARD ─────────────────────────────────────────────────────────────
function PersonCard({ person, index, scanLoading, onChange, onRemove, onScan }) {
  const up = k => v => onChange({...person,[k]:v});
  const isCapo = index === 0;
  return (
    <div style={{ border:`1.5px solid ${isCapo ? C.brown+"55" : C.border}`, borderRadius:12, overflow:"hidden", marginBottom:12 }}>
      {/* card header */}
      <div style={{ background: isCapo ? C.brown+"0d" : C.light, padding:"11px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:`1px solid ${isCapo?C.brown+"22":C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:26, height:26, borderRadius:"50%", background:isCapo?C.brown:"#ddd", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:isCapo?"#fff":C.mid, fontFamily:"sans-serif" }}>
            {index+1}
          </div>
          <span style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:17, fontWeight:600, color:C.dark }}>
            {isCapo ? "Capogruppo" : `Accompagnatore ${index}`}
          </span>
          {(person.cognome||person.nome) && (
            <span style={{ fontSize:13, color:C.muted, fontFamily:"sans-serif" }}>
              · {person.cognome} {person.nome}
            </span>
          )}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={onScan} title="Scansiona documento"
            style={{ background:C.cream, border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 10px", cursor:"pointer", fontSize:13 }}>
            📷 Scansiona
          </button>
          {!isCapo && (
            <button onClick={onRemove} title="Rimuovi"
              style={{ background:"#fdf5f5", border:`1px solid ${C.red}33`, borderRadius:6, padding:"5px 10px", cursor:"pointer", fontSize:13, color:C.red }}>
              ✕
            </button>
          )}
        </div>
      </div>
      {/* card body */}
      <div style={{ padding:14 }}>
        {scanLoading ? <Spinner /> : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Field label="Cognome" value={person.cognome} onChange={up("cognome")} />
            <Field label="Nome" value={person.nome} onChange={up("nome")} />
            <Field label="Sesso" value={person.sesso} onChange={up("sesso")} options={["M","F"]} />
            <Field label="Data nascita" value={person.dataNascita} onChange={up("dataNascita")} type="date" />
            <Field label="Comune nascita" value={person.comuneNascita} onChange={up("comuneNascita")} />
            <Field label="Provincia (sigla)" value={person.provinciaNascita} onChange={up("provinciaNascita")} />
            <Field label="Stato nascita" value={person.statoNascita} onChange={up("statoNascita")} />
            <Field label="Cittadinanza" value={person.cittadinanza} onChange={up("cittadinanza")} />
            <Field label="Tipo documento" value={person.tipoDoc} onChange={up("tipoDoc")} options={["CARTA D'IDENTITÀ","PASSAPORTO","PATENTE"]} />
            <Field label="N° documento" value={person.numDoc} onChange={up("numDoc")} />
            <Field label="Luogo di rilascio" value={person.luogoRilascio} onChange={up("luogoRilascio")} span />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BOOKING ROW (archivio interno) ──────────────────────────────────────────
function BookingRow({ booking, onDelete }) {
  const [open, setOpen] = useState(false);
  const t = today();
  const isIn = booking.dataArrivo <= t && (!booking.dataPartenza || booking.dataPartenza >= t);
  const capo = booking.guests[0];
  const extra = booking.guests.length - 1;
  return (
    <div style={{ background:"#fff", borderRadius:12, border:`1px solid ${C.border}`, marginBottom:10, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 16px", cursor:"pointer" }} onClick={()=>setOpen(o=>!o)}>
        <div style={{ width:36,height:36,borderRadius:"50%",background:"#f0ebe3",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cormorant Garamond', serif",fontWeight:700,fontSize:15,color:C.brown,flexShrink:0 }}>
          {(capo?.cognome?.[0]||"?").toUpperCase()}
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontFamily:"'Cormorant Garamond', serif",fontSize:16,fontWeight:600,color:C.dark }}>
            {capo?.cognome} {capo?.nome}
            {extra>0 && <span style={{ fontSize:13,color:C.muted,fontWeight:400,marginLeft:6 }}>+{extra} {extra===1?"persona":"persone"}</span>}
          </div>
          <div style={{ fontSize:12,color:C.muted,fontFamily:"sans-serif" }}>
            {booking.stanza} · {booking.dataArrivo} → {booking.dataPartenza||"…"} · {booking.numPernottamenti} notti
          </div>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
          <span style={{ background:(isIn?C.green:C.muted)+"18",color:isIn?C.green:C.muted,border:`1px solid ${(isIn?C.green:C.muted)}40`,borderRadius:12,padding:"2px 10px",fontSize:11,fontFamily:"sans-serif",whiteSpace:"nowrap" }}>
            {isIn?"In struttura":"Check-out"}
          </span>
          <span style={{ color:C.faint,fontSize:13 }}>{open?"▲":"▼"}</span>
        </div>
      </div>
      {open && (
        <div style={{ borderTop:`1px solid ${C.light}`,padding:14 }}>
          {booking.guests.map((g,i)=>(
            <div key={g._pid||i} style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:i<booking.guests.length-1?`1px solid ${C.light}`:"none" }}>
              <div style={{ width:22,height:22,borderRadius:"50%",background:i===0?C.brown:"#e8e0d4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:i===0?"#fff":C.muted,fontFamily:"sans-serif",flexShrink:0 }}>{i+1}</div>
              <div style={{ flex:1 }}>
                <span style={{ fontFamily:"'Crimson Pro', serif",fontSize:15,color:C.dark }}>{g.cognome} {g.nome}</span>
                <span style={{ fontSize:11,color:C.muted,fontFamily:"sans-serif",marginLeft:8 }}>{g.cittadinanza} · {g.tipoDoc} {g.numDoc}</span>
              </div>
              <span style={{ fontSize:11,color:C.muted,fontFamily:"sans-serif" }}>{i===0?"Capogruppo":"Accomp."}</span>
            </div>
          ))}
          <button onClick={onDelete} style={{ marginTop:12,background:"#fdf5f5",border:`1px solid ${C.red}33`,borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:13,color:C.red,fontFamily:"sans-serif" }}>🗑 Elimina soggiorno</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function CheckInApp() {
  const [tab, setTab]         = useState("inserimento");   // analisi | inserimento | esporta
  const [insertStep, setInsertStep] = useState("stay");    // stay | guests
  const [booking, setBooking] = useState(emptyBooking());
  const [scanningIdx, setScanningIdx] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [dbLoading, setDbLoading]   = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");    // idle | saving | saved
  const [conflict, setConflict]     = useState(null);       // conflicting booking or null

  // export filters
  const [expType, setExpType]   = useState("questura");    // questura | istat
  const [expDate, setExpDate]   = useState(today());       // for questura
  const [expYear, setExpYear]   = useState(new Date().getFullYear());
  const [expMonth, setExpMonth] = useState(new Date().getMonth());  // 0-based

  const fileRef   = useRef();
  const scanIdx   = useRef(null);

  useEffect(() => { loadBookings().then(b=>{ setBookings(b); setDbLoading(false); }); }, []);

  // ── booking field helpers ──
  const updB = k => v => setBooking(b => {
    const updated = {...b, [k]:v};
    setConflict(findConflict(bookings, updated));
    return updated;
  });
  const updGuest = (idx, updated) => setBooking(b=>{ const g=[...b.guests]; g[idx]=updated; return {...b,guests:g}; });
  const addGuest = () => setBooking(b=>({...b,guests:[...b.guests,emptyPerson()]}));
  const removeGuest = idx => setBooking(b=>({...b,guests:b.guests.filter((_,i)=>i!==idx)}));

  // ── scan con Tesseract.js ──
  const triggerScan = idx => { scanIdx.current=idx; fileRef.current.click(); };

  // Estrae campi strutturati dal testo grezzo OCR di un documento italiano
  function parseDocumentText(text) {
    const t = text.toUpperCase().replace(/\n/g, " ").replace(/\s+/g, " ");
    const result = {};

    // Tipo documento
    if (/PASSAPORTO|PASSPORT/.test(t)) result.tipoDoc = "PASSAPORTO";
    else if (/PATENTE|DRIVING/.test(t)) result.tipoDoc = "PATENTE";
    else result.tipoDoc = "CARTA D'IDENTITÀ";

    // Numero documento (formato: CA00000AA o simili)
    const numDoc = t.match(/\b([A-Z]{2}\d{5}[A-Z]{2}|[A-Z]{2}\d{7}|[A-Z0-9]{7,9})\b/);
    if (numDoc) result.numDoc = numDoc[1];

    // Data di nascita (cerca pattern GG/MM/AAAA o GG.MM.AAAA o AAAA-MM-GG)
    const datePatterns = [
      /(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4})/g,
      /(\d{4})[\/\.\-](\d{2})[\/\.\-](\d{2})/g,
    ];
    const dates = [];
    for (const pat of datePatterns) {
      let m;
      while ((m = pat.exec(t)) !== null) {
        const [_, a, b, c] = m;
        // se primo gruppo è anno (4 cifre)
        if (a.length === 4) dates.push(`${a}-${b}-${c}`);
        else dates.push(`${c}-${b}-${a}`);
      }
    }
    // La data di nascita è solitamente la più vecchia
    if (dates.length > 0) {
      dates.sort();
      result.dataNascita = dates[0];
    }

    // Sesso
    if (/\bM\b|\bMASCHIO\b|\bMALE\b/.test(t)) result.sesso = "M";
    else if (/\bF\b|\bFEMMINA\b|\bFEMALE\b/.test(t)) result.sesso = "F";

    // Cognome e Nome — su carta identità italiana sono spesso dopo le etichette
    const cognomeMatch = t.match(/COGNOME[:\s]+([A-Z\s']+?)(?:\s{2,}|NOME|$)/);
    if (cognomeMatch) result.cognome = cognomeMatch[1].trim();

    const nomeMatch = t.match(/NOME[:\s]+([A-Z\s']+?)(?:\s{2,}|COGNOME|SESSO|NATO|$)/);
    if (nomeMatch) result.nome = nomeMatch[1].trim();

    // Comune di nascita
    const natoMatch = t.match(/NATO[\/A]?\s+A[:\s]+([A-Z\s']+?)(?:\s{2,}|IL|$)/);
    if (natoMatch) result.comuneNascita = natoMatch[1].trim();

    // Cittadinanza / Nazionalità
    if (/ITALIANA|ITALIAN/.test(t)) { result.cittadinanza = "ITALIA"; result.statoNascita = "ITALIA"; }

    return result;
  }

  const handleFileChange = useCallback(async e => {
    const file = e.target.files[0]; if(!file) return;
    const idx = scanIdx.current;
    setScanningIdx(idx);
    try {
      // Carica Tesseract.js dinamicamente
      const Tesseract = await import("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js");
      const { data: { text } } = await Tesseract.recognize(file, "ita+eng", {});
      const parsed = parseDocumentText(text);
      if (Object.keys(parsed).length > 0) {
        setBooking(b=>{ const g=[...b.guests]; g[idx]={...g[idx],...parsed}; return {...b,guests:g}; });
      }
    } catch(err) {
      console.error("OCR error", err);
    }
    setScanningIdx(null);
    e.target.value="";
  }, []);

  // ── save ──
  const handleSave = async () => {
    const c = findConflict(bookings, booking);
    if (c) { setConflict(c); return; }   // double-check at save time
    setSaveStatus("saving");
    const b = {...booking, id: booking.id||Date.now().toString(), createdAt: booking.createdAt||new Date().toISOString()};
    const updated = [b, ...bookings.filter(x=>x.id!==b.id)];
    setBookings(updated);
    await saveBookings(updated);
    setSaveStatus("saved");
    setTimeout(()=>{ setSaveStatus("idle"); setBooking(emptyBooking()); setInsertStep("stay"); setConflict(null); }, 1800);
  };

  const deleteBooking = async id => {
    const updated = bookings.filter(b=>b.id!==id);
    setBookings(updated); await saveBookings(updated);
  };

  // ── export helpers ──
  const bookingsForDate = bookings.filter(b => b.dataArrivo === expDate);
  const bookingsForMonth = bookings.filter(b => {
    if(!b.dataArrivo) return false;
    const [y,m] = b.dataArrivo.split("-").map(Number);
    return y===expYear && m-1===expMonth;
  });

  const exportQuestura = () => {
    const lines = bookingsForDate.flatMap(b=>b.guests.map((p,i)=>alloggiatiLine(p,b,i===0)));
    if(!lines.length){ alert("Nessun soggiorno trovato per la data selezionata."); return; }
    downloadFile(lines.join("\r\n"), `alloggiati_${expDate}.txt`, "text/plain");
  };

  const exportISTAT = () => {
    const rows = bookingsForMonth.flatMap(b=>b.guests.map((p,i)=>istatRow(p,b,i===0)));
    if(!rows.length){ alert(`Nessun soggiorno trovato per ${MONTHS_IT[expMonth]} ${expYear}.`); return; }
    downloadFile(ISTAT_HEADERS+"\r\n"+rows.join("\r\n"), `istat_${expYear}_${String(expMonth+1).padStart(2,"0")}.csv`, "text/csv");
  };

  // ── nav style ──
  const navTab = active => ({
    flex:1, padding:"11px 6px", border:"none", borderRadius:0,
    borderBottom: active ? `2.5px solid ${C.brown}` : "2px solid transparent",
    background:"transparent", color: active ? "#f5efe4" : "#8a7060",
    fontFamily:"'Cormorant Garamond', serif", fontSize:15, cursor:"pointer",
    fontWeight: active?600:400, transition:"color 0.2s, border-color 0.2s"
  });

  const capoOk = booking.guests[0]?.cognome && booking.guests[0]?.nome && booking.guests[0]?.dataNascita;

  // years for ISTAT select
  const years = Array.from({length:5},(_,i)=>new Date().getFullYear()-i);

  return (
    <div style={{ minHeight:"100vh", background:C.light, fontFamily:"'Crimson Pro', serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Crimson+Pro:wght@300;400;600&display=swap" rel="stylesheet" />

      {/* ── HEADER ── */}
      <div style={{ background:C.dark, padding:"18px 20px 0" }}>
        <div style={{ maxWidth:640, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <span style={{ fontSize:26 }}>🏡</span>
            <div>
              <h1 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:21, fontWeight:700, margin:0, color:"#f5efe4", letterSpacing:"0.02em" }}>
                Check-In Manager
              </h1>
              <p style={{ fontSize:11, color:C.muted, margin:0, fontFamily:"sans-serif" }}>Affittacamere · Piemonte</p>
            </div>
            {bookings.length>0 && (
              <div style={{ marginLeft:"auto", background:C.brown+"cc", borderRadius:20, padding:"3px 12px", fontSize:12, fontFamily:"sans-serif", color:"#fff" }}>
                {bookings.reduce((s,b)=>s+b.guests.length,0)} ospiti · {bookings.length} soggiorni
              </div>
            )}
          </div>
          {/* 3-tab nav */}
          <div style={{ display:"flex", borderTop:`1px solid #3e3020` }}>
            <button style={navTab(tab==="analisi")}    onClick={()=>setTab("analisi")}>📊 Analisi Dati</button>
            <button style={navTab(tab==="inserimento")} onClick={()=>setTab("inserimento")}>＋ Inserimento</button>
            <button style={navTab(tab==="esporta")}    onClick={()=>setTab("esporta")}>📤 Esporta</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:640, margin:"0 auto", padding:"22px 16px" }}>

        {/* ══ ANALISI DATI ══════════════════════════════════════════════════ */}
        {tab==="analisi" && (
          <div style={{ ...cardStyle, textAlign:"center", padding:60 }}>
            <div style={{ fontSize:48, marginBottom:16 }}>📊</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:26, color:C.dark, margin:"0 0 10px" }}>Analisi Dati</h2>
            <p style={{ color:C.muted, fontSize:15, lineHeight:1.7, maxWidth:340, margin:"0 auto" }}>
              Questa sezione sarà disponibile prossimamente.<br/>
              Grafici presenze, nazionalità, occupazione per stanza e statistiche mensili.
            </p>
          </div>
        )}

        {/* ══ INSERIMENTO SOGGIORNO ═════════════════════════════════════════ */}
        {tab==="inserimento" && (
          <>
            {/* sub-steps pill */}
            <div style={{ display:"flex", gap:6, marginBottom:18 }}>
              {[["stay","1. Camera & Data"],["guests","2. Ospiti"]].map(([s,label])=>(
                <div key={s} style={{ flex:1, textAlign:"center", padding:"7px 6px", borderRadius:22, fontSize:13, fontFamily:"sans-serif", background:insertStep===s?C.brown:"#e2d8cc", color:insertStep===s?"#fff":C.muted, transition:"all 0.25s" }}>
                  {label}
                </div>
              ))}
            </div>

            {/* ── STEP 1: Camera & Data ── */}
            {insertStep==="stay" && (
              <div style={cardStyle}>
                <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:23, color:C.dark, marginTop:0, marginBottom:6 }}>
                  Seleziona camera e data
                </h2>
                <p style={{ color:C.mid, fontSize:14, margin:"0 0 22px", lineHeight:1.5 }}>
                  Scegli la stanza e le date del soggiorno. Questi dati si applicheranno a tutti gli ospiti del gruppo.
                </p>

                {/* Camera */}
                <div style={{ marginBottom:20 }}>
                  <label style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.12em", color:C.muted, fontFamily:"sans-serif", display:"block", marginBottom:6 }}>Camera</label>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                    {STANZE.map(s => {
                      const isSelected = booking.stanza === s;
                      // check if this room has any overlap with current dates
                      const testBooking = {...booking, stanza:s};
                      const roomConflict = findConflict(bookings, testBooking);
                      return (
                        <button key={s} onClick={()=>updB("stanza")(s)}
                          style={{ padding:"12px 8px", border:`2px solid ${isSelected ? C.brown : roomConflict ? C.red+"88" : C.border}`, borderRadius:10, background: isSelected ? C.brown+"10" : roomConflict ? "#fdf0f0" : "#fff", color: isSelected ? C.brown : roomConflict ? C.red : C.mid, fontFamily:"'Cormorant Garamond', serif", fontSize:14, cursor:"pointer", transition:"all 0.2s", fontWeight: isSelected ? 600 : 400, textAlign:"center", position:"relative" }}>
                          {roomConflict && !isSelected && (
                            <span style={{ position:"absolute", top:4, right:6, fontSize:10, color:C.red, fontFamily:"sans-serif" }}>●</span>
                          )}
                          <div style={{ fontSize:11, color:isSelected?C.brown:roomConflict?C.red:C.faint, fontFamily:"sans-serif", marginBottom:2 }}>{s.split(" ")[0]}</div>
                          {s.split(" ").slice(1).join(" ")}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:22 }}>
                  <Field label="Data arrivo" value={booking.dataArrivo} onChange={updB("dataArrivo")} type="date" />
                  <Field label="Data partenza" value={booking.dataPartenza} onChange={updB("dataPartenza")} type="date" />
                  <Field label="N° pernottamenti" value={booking.numPernottamenti} onChange={updB("numPernottamenti")} type="number" />
                </div>

                {/* Conflict warning */}
                {conflict && (
                  <div style={{ background:"#fdf0f0", border:`1.5px solid ${C.red}55`, borderRadius:10, padding:"14px 16px", marginBottom:18, display:"flex", gap:12, alignItems:"flex-start" }}>
                    <span style={{ fontSize:22, flexShrink:0 }}>🚫</span>
                    <div>
                      <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:17, fontWeight:600, color:C.red, marginBottom:4 }}>
                        Camera non disponibile
                      </div>
                      <div style={{ fontSize:13, color:"#8a3030", fontFamily:"sans-serif", lineHeight:1.5 }}>
                        <strong>{booking.stanza}</strong> è già occupata dal{" "}
                        <strong>{conflict.dataArrivo}</strong> al{" "}
                        <strong>{conflict.dataPartenza||"data aperta"}</strong> da{" "}
                        <strong>{conflict.guests[0]?.cognome} {conflict.guests[0]?.nome}</strong>.
                        <br/>Scegli un'altra camera o modifica le date.
                      </div>
                    </div>
                  </div>
                )}

                <Btn full onClick={()=>setInsertStep("guests")} disabled={!!conflict}>
                  Continua: inserisci ospiti →
                </Btn>
              </div>
            )}

            {/* ── STEP 2: Ospiti ── */}
            {insertStep==="guests" && (
              <div>
                <input ref={fileRef} type="file" accept="image/*" capture="environment"
                  onChange={handleFileChange} style={{display:"none"}} />

                {/* stay summary bar */}
                <div style={{ ...cardStyle, padding:"12px 18px", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                  <div>
                    <span style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:18, fontWeight:600, color:C.dark }}>{booking.stanza}</span>
                    <span style={{ fontSize:13, color:C.muted, fontFamily:"sans-serif", marginLeft:12 }}>
                      {booking.dataArrivo} → {booking.dataPartenza||"…"} · {booking.numPernottamenti} notti
                    </span>
                  </div>
                  <button onClick={()=>setInsertStep("stay")}
                    style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 12px", cursor:"pointer", fontSize:13, color:C.muted, fontFamily:"sans-serif" }}>
                    ✏️ Modifica
                  </button>
                </div>

                {booking.guests.map((person,idx)=>(
                  <PersonCard key={person._pid||idx} person={person} index={idx}
                    scanLoading={scanningIdx===idx}
                    onChange={updated=>updGuest(idx,updated)}
                    onRemove={()=>removeGuest(idx)}
                    onScan={()=>triggerScan(idx)} />
                ))}

                {/* Add member */}
                <button onClick={addGuest} style={{
                  width:"100%", padding:"13px", border:`1.5px dashed #a0b898`, borderRadius:12,
                  background:"#f3f8f3", color:"#3a6a3a", fontFamily:"'Cormorant Garamond', serif",
                  fontSize:16, cursor:"pointer", marginBottom:14, letterSpacing:"0.02em"
                }}>
                  ＋ Aggiungi accompagnatore / familiare
                </button>

                {/* Save group */}
                {conflict && (
                  <div style={{ background:"#fdf0f0", border:`1.5px solid ${C.red}55`, borderRadius:10, padding:"12px 14px", marginBottom:10, fontSize:13, color:"#8a3030", fontFamily:"sans-serif", lineHeight:1.5 }}>
                    🚫 <strong>{booking.stanza}</strong> è in conflitto con un soggiorno esistente. Torna indietro e modifica camera o date.
                  </div>
                )}
                <Btn full
                  color={saveStatus==="saved" ? C.green : C.brown}
                  disabled={!capoOk || saveStatus==="saving" || !!conflict}
                  onClick={handleSave}
                  style={{ fontSize:18, padding:"14px" }}>
                  {saveStatus==="saving" ? "Salvataggio…" : saveStatus==="saved" ? "✓ Gruppo salvato!" : "💾 Salva gruppo"}
                </Btn>
                {!capoOk && <p style={{ textAlign:"center", fontSize:12, color:C.muted, fontFamily:"sans-serif", marginTop:6 }}>Compila almeno cognome, nome e data di nascita del capogruppo</p>}
              </div>
            )}
          </>
        )}

        {/* ══ ESPORTA ═══════════════════════════════════════════════════════ */}
        {tab==="esporta" && (
          <div>
            {/* Toggle questura / istat */}
            <div style={{ display:"flex", background:"#e2d8cc", borderRadius:10, padding:3, marginBottom:18 }}>
              {[["questura","🏛️ Questura"],["istat","📊 ISTAT Piemonte"]].map(([v,label])=>(
                <button key={v} onClick={()=>setExpType(v)} style={{
                  flex:1, padding:"10px", border:"none", borderRadius:8,
                  background:expType===v?"#fff":"transparent",
                  color:expType===v?C.dark:C.muted,
                  fontFamily:"'Cormorant Garamond', serif", fontSize:17,
                  cursor:"pointer", fontWeight:expType===v?600:400,
                  boxShadow:expType===v?"0 1px 6px rgba(0,0,0,0.1)":"none",
                  transition:"all 0.2s"
                }}>{label}</button>
              ))}
            </div>

            {/* ── QUESTURA ── */}
            {expType==="questura" && (
              <div style={cardStyle}>
                <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:22, color:C.dark, marginTop:0 }}>
                  Export Questura · Alloggiati Web
                </h2>
                <p style={{ color:C.mid, fontSize:14, lineHeight:1.6, margin:"0 0 20px" }}>
                  Seleziona la data di arrivo. Verranno inclusi tutti i soggiorni con check-in in quella data.
                </p>

                <div style={{ marginBottom:20 }}>
                  <label style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.12em", color:C.muted, fontFamily:"sans-serif", display:"block", marginBottom:6 }}>Data di arrivo</label>
                  <input type="date" value={expDate} onChange={e=>setExpDate(e.target.value)}
                    style={{ padding:"10px 14px", border:`1px solid ${C.border}`, borderRadius:8, fontFamily:"'Crimson Pro', serif", fontSize:16, background:C.cream, color:C.dark, outline:"none" }} />
                </div>

                {/* preview */}
                <div style={{ background:C.light, borderRadius:10, padding:14, marginBottom:20, minHeight:60 }}>
                  {dbLoading ? <span style={{color:C.muted,fontSize:14,fontFamily:"sans-serif"}}>Caricamento…</span> :
                   bookingsForDate.length===0 ? (
                    <span style={{ color:C.muted, fontSize:14, fontFamily:"sans-serif" }}>
                      Nessun soggiorno trovato per il {expDate}
                    </span>
                  ) : (
                    <>
                      <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:"0.1em", color:C.muted, fontFamily:"sans-serif", marginBottom:8 }}>
                        {bookingsForDate.reduce((s,b)=>s+b.guests.length,0)} ospiti in {bookingsForDate.length} {bookingsForDate.length===1?"soggiorno":"soggiorni"}
                      </div>
                      {bookingsForDate.map(b=>(
                        <div key={b.id} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}`, fontFamily:"sans-serif", fontSize:13 }}>
                          <span style={{ color:C.dark }}>{b.guests[0]?.cognome} {b.guests[0]?.nome} {b.guests.length>1?`+${b.guests.length-1}`:""}</span>
                          <span style={{ color:C.muted }}>{b.stanza}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <Btn full color={C.wine} onClick={exportQuestura}
                  disabled={bookingsForDate.length===0}>
                  📥 Scarica file .txt per Alloggiati Web
                </Btn>
                {bookingsForDate.length>0 && (
                  <p style={{ textAlign:"center", fontSize:12, color:C.muted, fontFamily:"sans-serif", marginTop:8 }}>
                    → Carica su <strong>alloggiatiweb.poliziadistato.it</strong>
                  </p>
                )}
              </div>
            )}

            {/* ── ISTAT ── */}
            {expType==="istat" && (
              <div style={cardStyle}>
                <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:22, color:C.dark, marginTop:0 }}>
                  Export ISTAT · ROSS 1000 Piemonte
                </h2>
                <p style={{ color:C.mid, fontSize:14, lineHeight:1.6, margin:"0 0 20px" }}>
                  Seleziona il mese di riferimento. Verranno inclusi tutti i soggiorni con check-in nel mese scelto.
                </p>

                {/* Month + Year selector */}
                <div style={{ display:"flex", gap:10, marginBottom:20, alignItems:"flex-end" }}>
                  <div style={{ flex:2 }}>
                    <label style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.12em", color:C.muted, fontFamily:"sans-serif", display:"block", marginBottom:6 }}>Mese</label>
                    <select value={expMonth} onChange={e=>setExpMonth(Number(e.target.value))}
                      style={{ width:"100%", padding:"10px 14px", border:`1px solid ${C.border}`, borderRadius:8, fontFamily:"'Crimson Pro', serif", fontSize:16, background:C.cream, color:C.dark, outline:"none" }}>
                      {MONTHS_IT.map((m,i)=><option key={i} value={i}>{m}</option>)}
                    </select>
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.12em", color:C.muted, fontFamily:"sans-serif", display:"block", marginBottom:6 }}>Anno</label>
                    <select value={expYear} onChange={e=>setExpYear(Number(e.target.value))}
                      style={{ width:"100%", padding:"10px 14px", border:`1px solid ${C.border}`, borderRadius:8, fontFamily:"'Crimson Pro', serif", fontSize:16, background:C.cream, color:C.dark, outline:"none" }}>
                      {years.map(y=><option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                {/* preview */}
                <div style={{ background:C.light, borderRadius:10, padding:14, marginBottom:20, minHeight:60 }}>
                  {dbLoading ? <span style={{color:C.muted,fontSize:14,fontFamily:"sans-serif"}}>Caricamento…</span> :
                   bookingsForMonth.length===0 ? (
                    <span style={{ color:C.muted, fontSize:14, fontFamily:"sans-serif" }}>
                      Nessun soggiorno trovato per {MONTHS_IT[expMonth]} {expYear}
                    </span>
                  ) : (
                    <>
                      <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:"0.1em", color:C.muted, fontFamily:"sans-serif", marginBottom:8 }}>
                        {bookingsForMonth.reduce((s,b)=>s+b.guests.length,0)} ospiti · {bookingsForMonth.length} soggiorni
                      </div>
                      {bookingsForMonth.map(b=>(
                        <div key={b.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}`, fontFamily:"sans-serif", fontSize:13 }}>
                          <span style={{ color:C.dark }}>{b.guests[0]?.cognome} {b.guests[0]?.nome} {b.guests.length>1?`+${b.guests.length-1}`:""}</span>
                          <span style={{ color:C.muted }}>{b.stanza} · {b.dataArrivo}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <Btn full color={C.blue} onClick={exportISTAT}
                  disabled={bookingsForMonth.length===0}>
                  📥 Scarica CSV per ROSS 1000 · {MONTHS_IT[expMonth]} {expYear}
                </Btn>
                {bookingsForMonth.length>0 && (
                  <p style={{ textAlign:"center", fontSize:12, color:C.muted, fontFamily:"sans-serif", marginTop:8 }}>
                    → Importa su <strong>servizi.regione.piemonte.it</strong> → Piemonte Dati Turismo<br/>
                    <span style={{color:C.faint}}>Scadenza: entro il 10 del mese successivo</span>
                  </p>
                )}
              </div>
            )}

            {/* Archivio soggiorni (sotto export) */}
            <div style={{ marginTop:22 }}>
              <h3 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:18, color:C.dark, marginBottom:12 }}>
                Archivio soggiorni
              </h3>
              {dbLoading && <div style={{...cardStyle,textAlign:"center",color:C.muted,padding:24}}>Caricamento…</div>}
              {!dbLoading && bookings.length===0 && (
                <div style={{...cardStyle,textAlign:"center",padding:36,color:C.muted}}>
                  <div style={{fontSize:32,marginBottom:8}}>📭</div>
                  Nessun soggiorno registrato
                </div>
              )}
              {bookings.map(b=>(
                <BookingRow key={b.id} booking={b} onDelete={()=>deleteBooking(b.id)} />
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign:"center", marginTop:24, fontSize:11, color:C.faint, fontFamily:"sans-serif", lineHeight:1.7 }}>
          🔒 Dati archiviati localmente sul tuo dispositivo · GDPR compliant
        </div>
      </div>
    </div>
  );
}
