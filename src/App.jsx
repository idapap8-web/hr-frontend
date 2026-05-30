import { useState, useEffect, Component } from 'react';
import './App.css';

const API_URL = `http://${window.location.hostname}:3000`;
const DANI_NAZIVI = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];
const MESECI_NAZIVI = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

const LOZINKA_ADMIN = 'menadzer2026'; 
const LOZINKA_PREGLED = 'gledaj2026';  

const POCETNO_STANJE_FORME = {
  ime: '', prezime: '', pozicija: '', satnica: '',
  nocna_pocetak: '22:00', nocna_kraj: '06:00', nocni_bonus: '26',
  praznik_bonus: '110', go_procenat: '100', bolovanje_procenat: '65'
};

class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error("Navigacioni bag uhvaćen:", error, errorInfo); }
  componentDidUpdate(prevProps) {
    if (prevProps.aktivniTab !== this.props.aktivniTab) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:'2rem', background:'#7f1d1d', color:'white', borderRadius:'8px', margin:'2rem auto', maxWidth:'600px', textAlign:'center'}}>
          <h3>⚠️ Detektovan je privremeni problem u ovom delu aplikacije</h3>
          <p>Kliknite na dugme "Početna" u gornjem meniju da se bezbedno vratite nazad.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [isUlogovan, setIsUlogovan] = useState(false);
  const [tipKorisnika, setTipKorisnika] = useState('gost'); 
  const [unosLozinke, setUnosLozinke] = useState('');
  const [greskaLozinka, setGreskaLozinka] = useState(false);
  
  const [aktivniTab, setAktivniTab] = useState('pocetna');

  const [zaposleni, setZaposleni] = useState([]);
  const [raspored, setRaspored] = useState([]); 
  const [odsustva, setOdsustva] = useState([]);
  const [ucitavam, setUcitavam] = useState(true);
  
  const [form, setForm] = useState(POCETNO_STANJE_FORME);
  const [idZaIzmenu, setIdZaIzmenu] = useState(null);

  const trenutniDatum = new Date();
  const [izabraniMesec, setIzabraniMesec] = useState(trenutniDatum.getMonth() + 1);
  const [izabranaGodina, setIzabranaGodina] = useState(trenutniDatum.getFullYear());
  
  const [izvestaj, setIzvestaj] = useState(null);
  const [prikaziIzvestaj, setPrikaziIzvestaj] = useState(false);

  const [godisnjiIzvestaj, setGodisnjiIzvestaj] = useState(null);
  const [prikaziGodisnji, setPrikaziGodisnji] = useState(false);

  // STANJA ZA NOVI MODAL NAPREDNIH ODSUSTAVA
  const [prikaziModalOdsustva, setPrikaziModalOdsustva] = useState(false);
  const [selektovaniRadnikOdsustvo, setSelektovaniRadnikOdsustvo] = useState(null);
  const [odsustvoForm, setOdsustvoForm] = useState({
    tip: 'GO',
    datumOd: trenutniDatum.toISOString().split('T')[0],
    datumDo: trenutniDatum.toISOString().split('T')[0]
  });

  const [statsFirme, setStatsFirme] = useState({ ukupnoSati: 0, ukupnoZarada: 0 });

  const uzmiDatumeTekuceNedelje = () => {
    const danas = new Date();
    const danUNedelji = danas.getDay();
    const razlikaDoPonedeljka = danas.getDate() - danUNedelji + (danUNedelji === 0 ? -6 : 1);
    const ponedeljak = new Date(danas.setDate(razlikaDoPonedeljka));
    const datumi = [];
    
    for (let i = 0; i < 7; i++) {
      const sledeciDan = new Date(ponedeljak);
      sledeciDan.setDate(ponedeljak.getDate() + i);
      datumi.push({ naziv: DANI_NAZIVI[i], formatirano: sledeciDan.toISOString().split('T')[0] });
    }
    return datumi;
  };

  const [trenutnaNedelja] = useState(uzmiDatumeTekuceNedelje());

  const lokalniObracunStats = (sveSmene, sviRadnici) => {
    let ukupniSati = 0;
    let ukupnaZarada = 0;
    const tekuciM = trenutniDatum.getMonth() + 1;
    const tekucaG = trenutniDatum.getFullYear();

    sviRadnici.forEach(radnik => {
      const radnikoveSmene = sveSmene.filter(s => {
        const d = new Date(s.datum);
        return s.zaposleni_id === radnik.id && (d.getMonth() + 1) === tekuciM && d.getFullYear() === tekucaG;
      });

      radnikoveSmene.forEach(smena => {
        const pVal = (smena.pocetak || '').toUpperCase().trim();
        if (pVal === 'GO' || pVal === 'BOL' || pVal === 'BOLOVANJE') {
          ukupniSati += 8;
          ukupnaZarada += 8 * parseFloat(radnik.satnica || 0) * (pVal === 'BOL' ? (parseFloat(radnik.bolovanje_procenat || 65)/100) : (parseFloat(radnik.go_procenat || 100)/100));
          return;
        }
        if (!smena.pocetak || !smena.kraj) return;
        let p = parseInt(smena.pocetak.split(':')[0]);
        let k = parseInt(smena.kraj.split(':')[0]);
        if (isNaN(p) || isNaN(k)) return;
        if (k === 0) k = 24;
        let trajanje = k > p ? k - p : 24 - p + k;
        ukupniSati += trajanje;
        ukupnaZarada += trajanje * parseFloat(radnik.satnica || 0);
      });
    });

    setStatsFirme({ ukupnoSati: ukupniSati, ukupnoZarada: Math.round(ukupnaZarada) });
  };

  const ucitajPodatke = async () => {
    setUcitavam(true);
    try {
      const podaciRadnici = await fetch(`${API_URL}/zaposleni`).then(res => res.ok ? res.json() : []).catch(() => []);
      const podaciRaspored = await fetch(`${API_URL}/raspored`).then(res => res.ok ? res.json() : []).catch(() => []);
      const podaciOdsustva = await fetch(`${API_URL}/odsustva`).then(res => res.ok ? res.json() : []).catch(() => []);

      setZaposleni(podaciRadnici); setRaspored(podaciRaspored); setOdsustva(podaciOdsustva);
      lokalniObracunStats(podaciRaspored, podaciRadnici);
    } catch (err) {
      console.error(err);
    } finally {
      setUcitavam(false);
    }
  };

  useEffect(() => { if (isUlogovan) ucitajPodatke(); }, [isUlogovan]);

  const proveriLozinku = (e) => {
    e.preventDefault();
    if (unosLozinke === LOZINKA_ADMIN) { setTipKorisnika('admin'); setIsUlogovan(true); } 
    else if (unosLozinke === LOZINKA_PREGLED) { setTipKorisnika('gost'); setIsUlogovan(true); } 
    else { setGreskaLozinka(true); }
  };

  const handleInputChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); };

  const sacuvajRadnika = (e) => {
    e.preventDefault();
    const url = idZaIzmenu ? `${API_URL}/zaposleni/${idZaIzmenu}` : `${API_URL}/zaposleni`;
    fetch(url, { method: idZaIzmenu ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).then(() => { setForm(POCETNO_STANJE_FORME); setIdZaIzmenu(null); ucitajPodatke(); alert('Uspešno sačuvano!'); });
  };

  const pripremiZaIzmenu = (radnik) => {
    setForm({ ...radnik }); setIdZaIzmenu(radnik.id); setAktivniTab('postavke');
  };

  const sacuvajSmenu = (radnikId, datum, pocetak, kraj) => {
    fetch(`${API_URL}/raspored`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zaposleni_id: radnikId, datum, pocetak, kraj }) }).then(() => {
      setRaspored(stari => {
        const ostali = stari.filter(r => !(r.zaposleni_id === radnikId && r.datum === datum));
        const noviNiz = [...ostali, { zaposleni_id: radnikId, datum, pocetak, kraj }];
        lokalniObracunStats(noviNiz, zaposleni);
        return noviNiz;
      });
    });
  };

  // FUNKCIJA KOJA AUTOMATSKI POPUNJAVA SVAKI DAN IZMEĐU "OD" I "DO" DATUMA
  const procesuirajGrupnoOdsustvo = async (e) => {
    e.preventDefault();
    if (!selektovaniRadnikOdsustvo) return;

    let start = new Date(odsustvoForm.datumOd);
    let end = new Date(odsustvoForm.datumDo);

    if (start > end) {
      alert("Datum 'Od' ne može biti nakon datuma 'Do'!");
      return;
    }

    setUcitavam(true);
    let tekuciDan = new Date(start);

    // Prolazimo kroz svaki dan u izabranom opsegu
    while (tekuciDan <= end) {
      const formatiranDatum = tekuciDan.toISOString().split('T')[0];
      
      // Šaljemo podatak na backend u tabelu rasporeda (kraj ostavljamo prazan jer je u pitanju celodnevno odsustvo)
      await fetch(`${API_URL}/raspored`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zaposleni_id: selektovaniRadnikOdsustvo.id,
          datum: formatiranDatum,
          pocetak: odsustvoForm.tip, 
          kraj: ''
        })
      });

      tekuciDan.setDate(tekuciDan.getDate() + 1);
    }

    setPrikaziModalOdsustva(false);
    await ucitajPodatke();
    alert(`Uspešno upisano odsustvo (${odsustvoForm.tip}) za radnika ${selektovaniRadnikOdsustvo.ime}!`);
  };

  const izracunajPlaniraneSateUNedelji = (radnikId) => {
    return raspored.filter(r => r.zaposleni_id === radnikId && trenutnaNedelja.some(n => n.formatirano === r.datum)).reduce((ukupno, smena) => {
      if (!smena.pocetak || ['GO','BOL'].includes(smena.pocetak.toUpperCase())) return ukupno;
      let p = parseInt(smena.pocetak.split(':')[0]); let k = parseInt(smena.kraj.split(':')[0]);
      if (k === 0) k = 24; return ukupno + (k > p ? k - p : 24 - p + k);
    }, 0);
  };

  const ucitajMesecniIzvestaj = (radnik) => {
    fetch(`${API_URL}/izvestaj/${radnik.id}?mesec=${izabraniMesec}&godina=${izabranaGodina}`)
      .then(res => res.json())
      .then(podaci => {
        setIzvestaj({ ...podaci, imeRadnika: `${radnik.ime} ${radnik.prezime}`, mesecText: MESECI_NAZIVI[izabraniMesec-1], godinaText: izabranaGodina });
        setPrikaziIzvestaj(true);
      });
  };

  const ucitajGodisnjiIzvestaj = (radnik) => {
    fetch(`${API_URL}/godisnji-izvestaj/${radnik.id}?godina=${izabranaGodina}`)
      .then(res => res.json())
      .then(podaci => {
        if(podaci && podaci.poMesecima) {
          setGodisnjiIzvestaj({ ...podaci, imeRadnika: `${radnik.ime} ${radnik.prezime}` });
        } else {
          const lazniMeseci = Array(12).fill(0).map((_, i) => ({ mesec: i + 1, sati: 0, zarada: 0 }));
          setGodisnjiIzvestaj({ godina: izabranaGodina, imeRadnika: `${radnik.ime} ${radnik.prezime}`, ukupnoSatiGodina: 0, ukupnoZaradaGodina: 0, poMesecima: lazniMeseci });
        }
        setPrikaziGodisnji(true);
      })
      .catch(() => {
        const lazniMeseci = Array(12).fill(0).map((_, i) => ({ mesec: i + 1, sati: 0, zarada: 0 }));
        setGodisnjiIzvestaj({ godina: izabranaGodina, imeRadnika: `${radnik.ime} ${radnik.prezime}`, ukupnoSatiGodina: 0, ukupnoZaradaGodina: 0, poMesecima: lazniMeseci });
        setPrikaziGodisnji(true);
      });
  };

  const dobijDanasnjiString = () => {
    return trenutniDatum.toISOString().split('T')[0];
  };

  if (!isUlogovan) {
    return (
      <div className="login-overlay">
        <div className="login-box">
          <h2>🔒 HR Menadžer Zaštita</h2>
          <form onSubmit={proveriLozinku}>
            <input type="password" placeholder="Lozinka" value={unosLozinke} onChange={(e) => setUnosLozinke(e.target.value)} required />
            <button type="submit" className="btn-primary w-100" style={{marginTop:'1rem'}}>Pristupi</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h1>HR Menadžer Pro</h1>
        
        <div style={{display:'flex', gap:'0.8rem'}}>
          {aktivniTab !== 'pocetna' && (
            <button onClick={() => setAktivniTab('pocetna')} style={{background:'#10b981', color:'white', border:'none', padding:'0.5rem 1rem', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', fontSize:'0.9rem'}}>
              🏠 Početna (Glavna)
            </button>
          )}
          <button className="btn-logout" onClick={() => setIsUlogovan(false)}>🚪 Odjavi se</button>
        </div>
      </header>

      <nav className="navbar">
        <button className={`nav-link ${aktivniTab === 'pocetna' ? 'active' : ''}`} onClick={() => setAktivniTab('pocetna')}>🏠 Početna</button>
        <button className={`nav-link ${aktivniTab === 'radnici' ? 'active' : ''}`} onClick={() => setAktivniTab('radnici')}>👥 Zaposleni i Izvještaji</button>
        <button className={`nav-link ${aktivniTab === 'planer' ? 'active' : ''}`} onClick={() => setAktivniTab('planer')}>📅 Planer Smena</button>
        {tipKorisnika === 'admin' && <button className={`nav-link ${aktivniTab === 'postavke' ? 'active' : ''}`} onClick={() => setAktivniTab('postavke')}>⚙️ Postavke / Dodaj</button>}
      </nav>

      {aktivniTab === 'radnici' && (
        <div className="history-selector" style={{background:'#1e293b', padding:'1rem', borderRadius:'8px', margin:'1rem auto', maxWidth:'1200px', display:'flex', gap:'1rem', alignItems:'center', justifyContent:'center'}}>
          <label style={{fontWeight:'bold', color: 'white'}}>Izaberi period za obračun:</label>
          <select value={izabraniMesec} onChange={(e)=>setIzabraniMesec(parseInt(e.target.value))} style={{padding:'0.5rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}}>
            {MESECI_NAZIVI.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={izabranaGodina} onChange={(e)=>setIzabranaGodina(parseInt(e.target.value))} style={{padding:'0.5rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}}>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
        </div>
      )}

      <TabErrorBoundary aktivniTab={aktivniTab}>
        <main className="tab-content">
          {ucitavam ? <p className="loading">Učitavanje podataka...</p> : (
            <>
              {/* === POČETNA STRANA (DASHBOARD) === */}
              {aktivniTab === 'pocetna' && (
                <div className="fade-in" style={{maxWidth:'1100px', margin:'0 auto', color:'white', textAlign:'left'}}>
                  <div style={{background:'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding:'2rem', borderRadius:'12px', marginBottom:'2rem', border:'1px solid #334155'}}>
                    <h2 style={{marginTop:0, color:'#38bdf8'}}>Dobrodošli nazad u kontrolnu tablu</h2>
                    <p style={{color:'#94a3b8', margin:0}}>Pregled rada i statistike za tekući period: <strong>{MESECI_NAZIVI[trenutniDatum.getMonth()]} {trenutniDatum.getFullYear()}.</strong></p>
                  </div>

                  <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'1.5rem', marginBottom:'2rem'}}>
                    <div style={{background:'#1e293b', padding:'1.5rem', borderRadius:'8px', borderLeft:'5px solid #38bdf8', border:'1px solid #334155'}}>
                      <div style={{fontSize:'0.85rem', color:'#94a3b8', fontWeight:'bold', textTransform:'uppercase'}}>Fond sati firme (Ovaj mesec)</div>
                      <div style={{fontSize:'2.2rem', fontWeight:'bold', marginTop:'0.5rem', color:'white'}}>{statsFirme.ukupnoSati} h</div>
                    </div>
                    <div style={{background:'#1e293b', padding:'1.5rem', borderRadius:'8px', borderLeft:'5px solid #10b981', border:'1px solid #334155'}}>
                      <div style={{fontSize:'0.85rem', color:'#94a3b8', fontWeight:'bold', textTransform:'uppercase'}}>Procenjeni trošak plata</div>
                      <div style={{fontSize:'2.2rem', fontWeight:'bold', marginTop:'0.5rem', color:'#34d399'}}>{statsFirme.ukupnoZarada} RSD</div>
                    </div>
                    <div style={{background:'#1e293b', padding:'1.5rem', borderRadius:'8px', borderLeft:'5px solid #a855f7', border:'1px solid #334155'}}>
                      <div style={{fontSize:'0.85rem', color:'#94a3b8', fontWeight:'bold', textTransform:'uppercase'}}>Ukupno zaposlenih</div>
                      <div style={{fontSize:'2.2rem', fontWeight:'bold', marginTop:'0.5rem', color:'white'}}>{zaposleni.length} radnika</div>
                    </div>
                  </div>

                  {/* DANASNJI RASPORED */}
                  <div style={{background:'#1e293b', padding:'2rem', borderRadius:'8px', border:'1px solid #334155', marginBottom:'2rem'}}>
                    <h3 style={{marginTop:0, color:'white', borderBottom:'1px solid #334155', paddingBottom:'0.5rem'}}>
                      <span>📅 Ko radi danas? ({trenutniDatum.getDate()}. {MESECI_NAZIVI[trenutniDatum.getMonth()]})</span>
                    </h3>
                    
                    <div style={{marginTop:'1rem'}}>
                      {zaposleni.filter(r => raspored.some(s => s.zaposleni_id === r.id && s.datum === dobijDanasnjiString() && s.pocetak)).length === 0 ? (
                        <p style={{color:'#94a3b8', margin:0, fontStyle:'italic'}}>Nema upisanih smena za današnji dan u planer.</p>
                      ) : (
                        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'1rem'}}>
                          {zaposleni.map(radnik => {
                            const danasnjaSmena = raspored.find(s => s.zaposleni_id === radnik.id && s.datum === dobijDanasnjiString());
                            if (!danasnjaSmena || !danasnjaSmena.pocetak) return null;
                            return (
                              <div key={radnik.id} style={{background:'#0f172a', padding:'1rem', borderRadius:'6px', border:'1px solid #1e293b', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <div>
                                  <strong style={{color:'white', display:'block'}}>{radnik.ime} {radnik.prezime}</strong>
                                  <span style={{fontSize:'0.8rem', color:'#94a3b8'}}>{radnik.pozicija}</span>
                                </div>
                                <span style={{background: ['GO','BOL'].includes(danasnjaSmena.pocetak.toUpperCase()) ? '#b45309' : '#0284c7', color:'white', padding:'0.3rem 0.6rem', borderRadius:'4px', fontSize:'0.85rem', fontWeight:'bold'}}>
                                  {danasnjaSmena.pocetak} {danasnjaSmena.kraj ? `- ${danasnjaSmena.kraj}` : ''}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{display:'flex', gap:'1rem', flexWrap:'wrap'}}>
                    <button onClick={() => setAktivniTab('planer')} style={{background:'#0284c7', color:'white', padding:'0.8rem 1.5rem', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold'}}>📅 Otvori Planer Smena</button>
                    <button onClick={() => setAktivniTab('radnici')} style={{background:'#475569', color:'white', padding:'0.8rem 1.5rem', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold'}}>📊 Pogledaj Obračne i Izvještaje</button>
                  </div>
                </div>
              )}

              {/* === ZAPOSLENI I IZVEŠTAJI === */}
              {aktivniTab === 'radnici' && (
                <div className="fade-in">
                  <div className="cards-grid">
                    {zaposleni.map((radnik) => radnik && (
                      <div key={radnik.id} className="worker-card">
                        <h2>{radnik.ime} {radnik.prezime}</h2>
                        <div className="worker-role">{radnik.pozicija}</div>
                        
                        <div style={{display:'flex', flexDirection:'column', gap:'0.5rem', marginTop:'1rem'}}>
                          <button onClick={() => ucitajMesecniIzvestaj(radnik)} className="btn-action info" style={{background:'#0284c7', color: 'white', border: 'none', padding: '0.6rem', borderRadius: '4px', cursor: 'pointer'}}>
                            📊 Mesečni Izveštaj ({MESECI_NAZIVI[izabraniMesec-1]})
                          </button>
                          <button onClick={() => ucitajGodisnjiIzvestaj(radnik)} className="btn-action dark" style={{background:'#475569', color: 'white', border: 'none', padding: '0.6rem', borderRadius: '4px', cursor: 'pointer'}}>
                            📅 Godišnji Izveštaj ({izabranaGodina})
                          </button>
                          
                          {/* NOVO DUGME ZA PLANIRANJE ODSUSTVA */}
                          {tipKorisnika === 'admin' && (
                            <button onClick={() => { setSelektovaniRadnikOdsustvo(radnik); setPrikaziModalOdsustva(true); }} style={{background:'#b45309', color: 'white', border: 'none', padding: '0.6rem', borderRadius: '4px', cursor: 'pointer', fontWeight:'bold', marginTop:'4px'}}>
                              🌴 Evidentiraj Odsustvo (GO / BOL)
                            </button>
                          )}
                        </div>

                        {tipKorisnika === 'admin' && (
                          <div className="card-footer-buttons" style={{marginTop:'0.8rem'}}>
                            <button onClick={() => pripremiZaIzmenu(radnik)} className="btn-outline info" style={{color:'#10b981', borderColor:'#10b981'}}>Izmeni</button>
                            <button onClick={() => { if(confirm("Obrisati?")) fetch(`${API_URL}/zaposleni/${radnik.id}`, {method:'DELETE'}).then(()=>ucitajPodatke()); }} className="btn-outline danger">Obriši</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* === PLANER === */}
              {aktivniTab === 'planer' && (
                <div className="fade-in">
                  <div className="table-container">
                    <div className="scrollable-table">
                      <table>
                        <thead>
                          <tr>
                            <th className="text-left">Zaposleni</th>
                            {trenutnaNedelja.map(dan => <th key={dan.formatirano}>{dan.naziv}</th>)}
                            <th>Sati</th>
                          </tr>
                        </thead>
                        <tbody>
                          {zaposleni.map(radnik => radnik && (
                            <tr key={radnik.id}>
                              <td className="text-left font-light">{radnik.ime} {radnik.prezime}</td>
                              {trenutnaNedelja.map(dan => {
                                const smena = raspored.find(r => r.zaposleni_id === radnik.id && r.datum === dan.formatirano) || { pocetak: '', kraj: '' };
                                return (
                                  <td key={dan.formatirano}>
                                    <div className="table-inputs-group">
                                      <input type="text" value={smena.pocetak || ''} onChange={(e) => sacuvajSmenu(radnik.id, dan.formatirano, e.target.value, smena.kraj)} placeholder="08:00" />
                                      <input type="text" value={smena.kraj || ''} onChange={(e) => sacuvajSmenu(radnik.id, dan.formatirano, smena.pocetak, e.target.value)} placeholder="16:00" />
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="font-bold">{izracunajPlaniraneSateUNedelji(radnik.id)} h</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* === POSTAVKE === */}
              {aktivniTab === 'postavke' && (
                <div className="fade-in">
                  <form onSubmit={sacuvajRadnika} className="hr-form" style={{maxWidth:'650px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'0.8rem', background:'#1e293b', padding:'2rem', borderRadius:'8px', color:'white'}}>
                    <h3 style={{marginTop:0, borderBottom:'1px solid #334155', paddingBottom:'0.5rem'}}>{idZaIzmenu ? '📝 Izmena podataka o zaposlenom' : '👤 Dodavanje novog zaposlenog'}</h3>
                    
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Ime:</label>
                        <input name="ime" placeholder="Ime" value={form.ime} onChange={handleInputChange} required style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Prezime:</label>
                        <input name="prezime" placeholder="Prezime" value={form.prezime} onChange={handleInputChange} required style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                    </div>

                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Radna Pozicija:</label>
                        <input name="pozicija" placeholder="Npr. Menadžer, Radnik..." value={form.pozicija} onChange={handleInputChange} required style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Satnica (RSD):</label>
                        <input type="number" name="satnica" placeholder="Cena po satu" value={form.satnica} onChange={handleInputChange} required style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                    </div>

                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginTop:'0.5rem', paddingTop:'0.5rem', borderTop:'1px solid #334155'}}>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Noćni rad počinje od:</label>
                        <input name="nocna_pocetak" value={form.nocna_pocetak} onChange={handleInputChange} style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Noćni rad traje do:</label>
                        <input name="nocna_kraj" value={form.nocna_kraj} onChange={handleInputChange} style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                    </div>

                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Noćni bonus (%):</label>
                        <input type="number" name="nocni_bonus" value={form.nocni_bonus} onChange={handleInputChange} style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Praznični bonus (%):</label>
                        <input type="number" name="praznik_bonus" value={form.praznik_bonus} onChange={handleInputChange} style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                    </div>

                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Godišnji odmor (% isplate):</label>
                        <input type="number" name="go_procenat" value={form.go_procenat} onChange={handleInputChange} style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Bolovanje (% isplate):</label>
                        <input type="number" name="bolovanje_procenat" value={form.bolovanje_procenat} onChange={handleInputChange} style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                    </div>

                    <div style={{display:'flex', gap:'1rem', marginTop:'1rem'}}>
                      <button type="submit" style={{flex:1, background:'#10b981', color:'white', border:'none', padding:'0.8rem', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>💾 Sačuvaj Radnika</button>
                      {idZaIzmenu && <button type="button" onClick={()=>{setForm(POCETNO_STANJE_FORME); setIdZaIzmenu(null);}} style={{background:'#64748b', color:'white', border:'none', padding:'0.8rem', borderRadius:'4px', cursor:'pointer'}}>Otkaži</button>}
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </main>
      </TabErrorBoundary>

      {/* === POTPUNO NOVI MODAL ZA EVIDENTIRANJE ODSUSTVA (BRZO I GRUPNO) === */}
      {prikaziModalOdsustva && selektovaniRadnikOdsustvo && (
        <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', backgroundColor:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:99999}}>
