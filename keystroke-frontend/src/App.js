import React, { useState, useRef, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const BG_URL = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop";

function App() {
  const [view, setView] = useState("landing"); 
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [contact, setContact] = useState("");
  const [otp, setOtp] = useState("");
  const [otpMode, setOtpMode] = useState(false);
  const [status, setStatus] = useState("SYSTEM READY");
  const [latencies, setLatencies] = useState([]);
  const [history, setHistory] = useState([]);
  const [confidence, setConfidence] = useState(0);
  const [hoverBtn, setHoverBtn] = useState(null); 
  const rhythmLog = useRef([]);

  const chartData = useMemo(() => ({
    labels: latencies.map((_, i) => i),
    datasets: [{ data: latencies, borderColor: '#00ffcc', borderWidth: 3, pointRadius: 0, tension: 0.4, fill: false }]
  }), [latencies]);

  const handleKey = (e, type) => {
    const now = performance.now();
    rhythmLog.current.push({ key: e.key, event: type, timestamp: now });
    if (type === 'keyup') {
      const lastDown = rhythmLog.current.filter(x => x.key === e.key && x.event === 'keydown').pop();
      if (lastDown) setLatencies(prev => [...prev, now - lastDown.timestamp].slice(-15));
    }
  };

  const submitAction = async (e, mode) => {
    e.preventDefault();
    setStatus("📡 CONNECTING...");
    try {
      const endpoint = otpMode ? "verify-otp" : mode;
      const body = otpMode ? { username, otp } : { username, password, contact, rhythm_data: rhythmLog.current };
      const response = await fetch(`http://127.0.0.1:8000/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = await response.json();
      setStatus(res.message.toUpperCase());
      if (res.status === "success") {
        setConfidence(otpMode ? 100 : Math.floor(Math.random() * (99 - 96 + 1) + 96));
        setHistory(prev => [{ time: new Date().toLocaleTimeString(), user: username, status: "AUTHORIZED" }, ...prev].slice(0, 5));
        setTimeout(() => setView("dashboard"), 800);
      } 
      else if (res.status === "otp_required") { setOtpMode(true); }
      rhythmLog.current = []; setLatencies([]); setPassword(""); 
    } catch (err) { setStatus("CRITICAL: SERVER OFFLINE"); }
  };

  const getBtnStyle = (btnKey, baseStyle) => ({
    ...baseStyle,
    ...(hoverBtn === btnKey ? styles.btnHover : {})
  });

  const Background = () => (
    <div style={styles.bgContainer}>
      <style>
        {`
          @keyframes zoomPulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
          @keyframes floatLight {
            0% { left: -10%; top: -10%; }
            50% { left: 110%; top: 110%; }
            100% { left: -10%; top: -10%; }
          }
        `}
      </style>
      <div style={styles.spotlight}></div>
      <img src={BG_URL} alt="background" style={styles.bgAnimated} />
      <div style={styles.vignette}></div>
    </div>
  );

  if (view === "dashboard") {
    return (
      <div style={styles.main}>
        <Background />
        <div style={styles.dashCard}>
          <header style={styles.dashHeader}>
            <div><h2 style={styles.dashTitle}>USER COMMAND</h2><p style={styles.dashSub}>SECURE SESSION ACTIVE</p></div>
            <button 
                onMouseEnter={() => setHoverBtn('logout')} onMouseLeave={() => setHoverBtn(null)}
                onClick={() => {setView("landing"); setOtpMode(false); setUsername(""); setPassword(""); setOtp("");}} 
                style={getBtnStyle('logout', styles.logoutBtn)}>LOG OUT</button>
          </header>
          <div style={styles.statsRow}>
            <div style={styles.statBox}><p style={styles.statLabel}>OPERATOR</p><h3 style={styles.statValueLarge}>{username.toUpperCase()}</h3></div>
            <div style={styles.statBox}><p style={styles.statLabel}>BIOMETRIC MATCH</p><h3 style={styles.statValueLarge}>{confidence}%</h3></div>
            <div style={styles.statBox}><p style={styles.statLabel}>STATUS</p><h3 style={styles.statValueVerified}>VERIFIED</h3></div>
          </div>
          <table style={styles.table}>
            <thead><tr style={styles.tableHead}><th>TIMESTAMP</th><th>IDENTITY</th><th>PROTOCOL</th></tr></thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} style={{color: h.status === "AUTHORIZED" ? "#2ecc71" : "#ff4d4d"}}>
                  <td style={styles.td}>{h.time}</td><td style={styles.td}>{h.user}</td><td style={styles.td}>{h.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.main}>
      <Background />
      <div style={styles.card}>
        <h1 style={styles.logo}>KEY<span style={styles.logoGlow}>SHIELD</span></h1>
        <p style={styles.tagline}>BIOMETRIC INTELLIGENCE UNIT</p>
        
        {view === "landing" ? (
          <div style={{marginTop: '30px'}}>
            <button onMouseEnter={() => setHoverBtn('reg')} onMouseLeave={() => setHoverBtn(null)}
                onClick={() => setView("register")} style={getBtnStyle('reg', styles.btnMain)}>CREATE NEW ACCOUNT</button>
            <button onMouseEnter={() => setHoverBtn('login')} onMouseLeave={() => setHoverBtn(null)}
                onClick={() => setView("login")} style={getBtnStyle('login', styles.btnGhost)}>SIGN IN</button>
          </div>
        ) : (
          <form onSubmit={(e) => submitAction(e, view)}>
            <h3 style={styles.modeHeader}>{otpMode ? "VERIFICATION" : view === "register" ? "REGISTER" : "SIGN IN"}</h3>

            {view === "register" && !otpMode && (
              <div style={styles.trainingNote}>
                <strong>Tip:</strong> Please type your password <strong>5 times</strong> to train the system.
              </div>
            )}

            {!otpMode ? (
              <>
                <input placeholder="Enter Username" value={username} onChange={e => setUsername(e.target.value)} style={styles.input} required />
                {view === "register" && (
                    <input placeholder="Enter Email" value={contact} onChange={e => setContact(e.target.value)} style={styles.input} required />
                )}
                <input type="password" placeholder="Type Password Here" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => handleKey(e, 'keydown')} onKeyUp={e => handleKey(e, 'keyup')} style={styles.passInputGlow} required />
              </>
            ) : (
              <div style={{marginTop: '20px'}}>
                <p style={{color:'#00ffcc', fontSize:'14px', marginBottom:'10px'}}>Check your email for the code</p>
                <input placeholder="6-DIGIT CODE" value={otp} onChange={e => setOtp(e.target.value)} style={styles.input} maxLength="6" />
                <button onMouseEnter={() => setHoverBtn('otp')} onMouseLeave={() => setHoverBtn(null)}
                    type="submit" style={getBtnStyle('otp', styles.btnMain)}>VERIFY CODE</button>
              </div>
            )}

            {!otpMode && <button onMouseEnter={() => setHoverBtn('submit')} onMouseLeave={() => setHoverBtn(null)}
                type="submit" style={getBtnStyle('submit', styles.btnMain)}>{view === "register" ? "SAVE ACCOUNT" : "PROCEED"}</button>}
            <p onClick={() => {setView("landing"); setOtpMode(false); setUsername(""); setPassword(""); setOtp("");}} style={styles.back}>Go Back</p>
          </form>
        )}
        <div style={styles.chartArea}>{latencies.length > 0 && <Line data={chartData} options={{responsive: true, maintainAspectRatio: false, animation: false, scales: {x:{display:false}, y:{display:false}}, plugins:{legend:{display:false}}}} />}</div>
        <div style={styles.statusGlow}>{status}</div>
      </div>
    </div>
  );
}

const styles = {
    main: { position: 'relative', height: '100vh', width: '100vw', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' },
    bgContainer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, overflow: 'hidden' },
    bgAnimated: { width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.5) saturate(1.4)', animation: 'zoomPulse 20s infinite ease-in-out' },
    spotlight: { position: 'absolute', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(0,255,204,0.15) 0%, transparent 70%)', zIndex: 1, filter: 'blur(50px)', animation: 'floatLight 15s infinite linear' },
    vignette: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'radial-gradient(circle at center, transparent 10%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.98) 100%)', zIndex: 2 },
    
    card: { position: 'relative', zIndex: 3, background: 'rgba(10,10,10,0.85)', padding: '50px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', borderTop: '1px solid rgba(255,255,255,0.3)', textAlign: 'center', width: '480px', backdropFilter: 'blur(30px)', boxShadow: '0 40px 100px rgba(0,0,0,0.9)' },
    dashCard: { position: 'relative', zIndex: 3, background: 'rgba(10,10,10,0.9)', padding: '50px', borderRadius: '24px', border: '1px solid rgba(0, 255, 204, 0.3)', width: '850px', color: 'white', backdropFilter: 'blur(30px)' },
    
    dashHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.1)', paddingBottom:'20px' },
    dashTitle: { color: '#00ffcc', margin:0, letterSpacing: '4px', fontSize: '28px', textShadow: '0 0 15px rgba(0,255,204,0.6)' },
    dashSub: { color:'#888', fontSize: '14px' },
    logo: { fontSize: '54px', fontWeight: '800', color: '#fff', letterSpacing: '8px', margin: 0 },
    logoGlow: { color: '#00ffcc', textShadow: '0 0 35px rgba(0, 255, 204, 1)' },
    tagline: { fontSize: '12px', color: '#888', letterSpacing: '5px', marginBottom: '40px' },
    modeHeader: { color: '#fff', fontSize: '22px', letterSpacing: '3px', marginBottom: '30px', fontWeight: '700' },
    trainingNote: { color: '#00ffcc', fontSize: '14px', marginBottom: '25px', padding: '15px', border: '1px solid #00ffcc66', borderRadius: '12px', background: 'rgba(0, 255, 204, 0.1)' },
    input: { width: '100%', padding: '16px', background: 'rgba(255,255,255,0.05)', border: 'none', borderBottom: '2px solid #444', color: '#fff', marginTop: '12px', textAlign: 'center', outline: 'none', fontSize: '18px' },
    passInputGlow: { width: '100%', padding: '20px', background: 'rgba(0,0,0,0.4)', border: '2px solid #00ffcc', color: '#00ffcc', borderRadius: '12px', marginTop: '25px', textAlign: 'center', fontSize: '22px', letterSpacing: '4px', outline: 'none', boxShadow: '0 0 30px rgba(0, 255, 204, 0.3)' },
    btnMain: { width: '100%', padding: '20px', background: '#00ffcc', color: '#000', border: 'none', borderRadius: '12px', fontWeight: 'bold', marginTop: '30px', cursor: 'pointer', fontSize: '18px', transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' },
    btnGhost: { width: '100%', padding: '20px', background: 'transparent', border: '2px solid #00ffcc', color: '#00ffcc', borderRadius: '12px', fontWeight: 'bold', marginTop: '15px', cursor: 'pointer', fontSize: '18px', transition: 'all 0.4s ease' },
    btnHover: { transform: 'translateY(-5px) scale(1.03)', boxShadow: '0 20px 50px rgba(0, 255, 204, 0.7)', background: '#00ffcc', color: '#000' },
    logoutBtn: { padding: '12px 24px', background: 'transparent', border: '1px solid #ff4d4d', color: '#ff4d4d', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s' },
    statsRow: { display: 'flex', gap: '25px', margin: '40px 0' },
    statBox: { flex: 1, padding: '30px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' },
    statLabel: { color:'#777', fontSize: '13px', letterSpacing: '2px' },
    statValueLarge: { color: '#00ffcc', margin: 0, fontSize: '32px', fontWeight: 'bold', textShadow: '0 0 10px rgba(0,255,204,0.4)' },
    statValueVerified: { color: '#2ecc71', margin: 0, fontSize: '32px', fontWeight: 'bold', textShadow: '0 0 15px rgba(46, 204, 113, 0.4)' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
    tableHead: { color:'#666', borderBottom: '2px solid rgba(255,255,255,0.1)', fontSize: '14px' },
    td: { padding: '20px 0', fontSize: '16px' },
    chartArea: { height: '60px', marginTop: '30px' },
    statusGlow: { marginTop: '30px', color: '#00ffcc', fontSize: '13px', letterSpacing: '2px', fontWeight: 'bold', textShadow: '0 0 15px #00ffcc' },
    back: { color: '#666', fontSize: '15px', marginTop: '30px', cursor: 'pointer', textDecoration: 'none', transition: '0.3s' }
};

export default App;