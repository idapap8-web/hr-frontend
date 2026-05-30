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

  // MAKSIMALNO OBEZBEĐEN OBRAČUN STATISTIKE - NEMA ŠANSE DA PADNE
  const lokalniObracunStats = (sveSmene, sviRadnici) => {
    let ukupniSati = 0;
    let ukupnaZarada = 0;
    const tekuciM = trenutniDatum.getMonth() + 1;
    const tekucaG = trenutniDatum.getFullYear();

    if (!Array.isArray(sviRadnici) || !Array.isArray(sveSmene)) return;

    sviRadnici.forEach(radnik => {
      if (!radnik || !radnik.id) return;
      
      const radnikoveSmene = sveSmene.filter(s => {
        if (!s || !s.datum || !s.zaposleni_id) return false;
        try {
          const d = new Date(s.datum);
          return s.zaposleni_id === radnik.id && (d.getMonth() + 1) === tekuciM && d.getFullYear() === tekucaG;
        } catch { return false; }
      });

      radnikoveSmene.forEach(smena => {
        if (!smena) return;
        const pVal = String(smena.pocetak || '').toUpperCase().trim();
        const kVal = String(smena.kraj || '').toUpperCase().trim();
        
        if (pVal === 'GO' || smena.is_go || (pVal === '00:00' && kVal === '00:00')) {
          ukupniSati += 8;
          ukupnaZarada += 8 * parseFloat(radnik.satnica || 0) * (parseFloat(radnik.go_procenat || 100)/100);
          return;
        }
        if (pVal === 'BOL' || smena.is_bolovanje || (pVal === '00:00' && kVal === '00:01')) {
          ukupniSati += 8;
          ukupnaZarada += 8 * parseFloat(radnik.satnica || 0) * (parseFloat(radnik.bolovanje_procenat || 65)/100);
          return;
        }
        
        if (!smena.pocetak || !smena.kraj || !String(smena.pocetak).includes(':') || !String(smena.kraj).includes(':')) return;
        
        try {
          let p = parseInt(smena.pocetak.split(':')[0]);
          let k = parseInt(smena.kraj.split(':')[0]);
          if (isNaN(p) || isNaN(k)) return;
          if (k === 0) k = 24;
          let trajanje = k > p ? k - p : 24 - p + k;
          ukupniSati += trajanje;
          ukupnaZarada += trajanje * parseFloat(radnik.satnica || 0);
        } catch (e) {
          console.error("Preskočena loša smena pri kalkulaciji:", e);
        }
      });
    });

    setStatsFirme({ ukupnoSati: ukupniSati, ukupnoZarada: Math.round(ukupnaZarada) });
  };

  const ucitajPodatke = async () => {
    setUcitavam(true);
    try {
      const podaciRadnici = await fetch(`${API_URL}/zaposleni`).then(res => res.ok ? res.json() : []).catch(() => []);
      const podaciRaspored = await fetch(`${API_URL}/raspored`).then(res => res.ok ? res.json() : []).catch(() => []);

      const bezbedniRadnici = Array.isArray(podaciRadnici) ? podaciRadnici : [];
      const bezbedniRaspored = Array.isArray(podaciRaspored) ? podaciRaspored : [];

      setZaposleni(bezbedniRadnici); 
      setRaspored(bezbedniRaspored); 
      lokalniObracunStats(bezbedniRaspored, bezbedniRadnici);
    } catch (err) {
      console.error("Greška pri učitavanju:", err);
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
    fetch(url, { method: idZaIzmenu ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      .then(() => { setForm(POCETNO_STANJE_FORME); setIdZaIzmenu(null); ucitajPodatke(); alert('Zaposleni uspešno sačuvan!'); });
  };

  const pripremiZaIzmenu = (radnik) => {
    setForm({ ...radnik }); setIdZaIzmenu(radnik.id); setAktivniTab('postavke');
  };

  const sacuvajSmenu = (radnikId, datum, pocetak, kraj) => {
    fetch(`${API_URL}/raspored`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zaposleni_id: radnikId, datum, pocetak, kraj }) }).then(() => {
      setRaspored(stari => {
        const ostali = stari.filter(r => !(r && r.zaposleni_id === radnikId && r.datum === datum));
        const noviNiz = [...ostali, { zaposleni_id: radnikId, datum, pocetak, kraj }];
        lokalniObracunStats(noviNiz, zaposleni);
        return noviNiz;
      });
    });
  };

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
    let biloGreske = false;
    let tekstGreske = "";

    const satPocetak = "00:00";
    const satKraj = odsustvoForm.tip === 'GO' ? "00:00" : "00:01";

    while (tekuciDan <= end) {
      const formatiranDatum = tekuciDan.toISOString().split('T')[0];
      
      try {
        const odgovor = await fetch(`${API_URL}/raspored`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zaposleni_id: selektovaniRadnikOdsustvo.id,
            datum: formatiranDatum,
            pocetak: satPocetak, 
            kraj: satKraj
          })
        });

        if (!odgovor.ok) {
          biloGreske = true;
          tekstGreske = await odgovor.text();
          break;
        }
      } catch (err) {
        biloGreske = true;
        tekstGreske = err.message;
        break;
      }
      tekuciDan.setDate(tekuciDan.getDate() + 1);
    }

    setPrikaziModalOdsustva(false);
    await ucitajPodatke();

    if (biloGreske) {
      alert(`Server greška: \n\n${tekstGreske}\n\nOdsustvo je upisano tamo gde je server dozvolio.`);
    } else {
      alert(`Uspešno upisano odsustvo (${odsustvoForm.tip})!`);
    }
  };

  const izracunajPlaniraneSateUNedelji = (radnikId) => {
    if (!Array.isArray(raspored)) return 0;
    return raspored.filter(r => r && r.zaposleni_id === radnikId && trenutnaNedelja.some(n => n.formatirano === r.datum)).reduce((ukupno, smena) => {
      if (!smena || !smena.pocetak) return ukupno;
      if (smena.pocetak === "00:00" && (smena.kraj === "00:00" || smena.kraj === "00:01")) {
        return ukupno + 8;
      }
      if (!String(smena.pocetak).includes(':') || !String(smena.kraj).includes(':')) return ukupno;
      try {
        let p = parseInt(smena.pocetak.split(':')[0]); 
        let k = parseInt(smena.kraj.split(':')[0]);
        if (k === 0) k = 24; 
        return ukupno + (k > p ? k - p : 24 - p + k);
      } catch { return ukupno; }
    }, 0);
  };

  const ucitajMesecniIzvestaj = (radnik) => {
    fetch(`${API_URL}/izvestaj/${radnik.id}?mesec=${izabraniMesec}&godina=${izabranaGodina}`)
      .then(res => res.json())
      .then(podaci => {
        setIzvestaj({ ...podaci, imeRadnika: `${radnik.ime} ${radnik.prezime}`, mesecText: MESECI_NAZIVI[izabraniMesec-1], godinaText: izabranaGodina });
        setPrikaziIzvestaj(true);
      }).catch(() => alert("Greška pri učitavanju mesečnog izveštaja. Proveri server!"));
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
            {greskaLozinka && <p style={{color:'#f87171', fontSize:'0.85rem', marginTop:'0.5rem'}}>Pogrešna lozinka!</p>}
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
              🏠 Početna
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
              {/* === POČETNA STRANA === */}
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
                    <h3 style={{marginTop:0, color:'white', borderBottom:'1px solid #334155', paddingBottom:'0.5rem'}}>📅 Ko radi danas?</h3>
                    <div style={{marginTop:'1rem'}}>
                      {zaposleni.filter(r => raspored.some(s => s && s.zaposleni_id === r.id && s.datum === dobijDanasnjiString() && s.pocetak)).length === 0 ? (
                        <p style={{color:'#94a3b8', margin:0, fontStyle:'italic'}}>Nema upisanih smena za današnji dan u planer.</p>
                      ) : (
                        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'1rem'}}>
                          {zaposleni.map(radnik => {
                            const danasnjaSmena = raspored.find(s => s && s.zaposleni_id === radnik.id && s.datum === dobijDanasnjiString());
                            if (!danasnjaSmena || !danasnjaSmena.pocetak) return null;
                            
                            let tekstSmene = `${danasnjaSmena.pocetak} - ${danasnjaSmena.kraj}`;
                            let bojaBedza = '#0284c7';
                            
                            if (danasnjaSmena.pocetak === "00:00") {
                              if (danasnjaSmena.kraj === "00:00") { tekstSmene = "🌴 GO"; bojaBedza = "#b45309"; }
                              else if (danasnjaSmena.kraj === "00:01") { tekstSmene = "🤒 BOL"; bojaBedza = "#b91c1c"; }
                            }

                            return (
                              <div key={radnik.id} style={{background:'#0f172a', padding:'1rem', borderRadius:'6px', border:'1px solid #1e293b', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <div>
                                  <strong style={{color:'white', display:'block'}}>{radnik.ime} {radnik.prezime}</strong>
                                  <span style={{fontSize:'0.8rem', color:'#94a3b8'}}>{radnik.pozicija}</span>
                                </div>
                                <span style={{background: bojaBedza, color:'white', padding:'0.3rem 0.6rem', borderRadius:'4px', fontSize:'0.85rem', fontWeight:'bold'}}>
                                  {tekstSmene}
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
                    <button onClick={() => setAktivniTab('radnici')} style={{background:'#475569', color:'white', padding:'0.8rem 1.5rem', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold'}}>📊 Obračun i Izvještaji</button>
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
                          {tipKorisnika === 'admin' && (
                            <button onClick={() => { setSelektovaniRadnikOdsustvo(radnik); setPrikaziModalOdsustva(true); }} style={{background:'#b45309', color: 'white', border: 'none', padding: '0.6rem', borderRadius: '4px', cursor: 'pointer', fontWeight:'bold', marginTop:'4px'}}>
                              🌴 Evidentiraj Odsustvo (GO / BOL)
                            </button>
                          )}
                        </div>

                        {tipKorisnika === 'admin' && (
                          <div className="card-footer-buttons" style={{marginTop:'0.8rem'}}>
                            <button onClick={() => pripremiZaIzmenu(radnik)} className="btn-outline info" style={{color:'#10b981', borderColor:'#10b981'}}>Izmeni</button>
                            <button onClick={() => { if(confirm("Obrisati zaposlenog?")) fetch(`${API_URL}/zaposleni/${radnik.id}`, {method:'DELETE'}).then(()=>ucitajPodatke()); }} className="btn-outline danger">Obriši</button>
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
                                const smena = raspored.find(r => r && r.zaposleni_id === radnik.id && r.datum === dan.formatirano) || { pocetak: '', kraj: '' };
                                
                                if (smena.pocetak === "00:00" && smena.kraj === "00:00") {
                                  return (
                                    <td key={dan.formatirano} style={{background: '#78350f', color: '#fef3c7', fontWeight: 'bold', textAlign: 'center', fontSize: '0.9rem'}}>
                                      🌴 GO
                                    </td>
                                  );
                                }
                                if (smena.pocetak === "00:00" && smena.kraj === "00:01") {
                                  return (
                                    <td key={dan.formatirano} style={{background: '#7f1d1d', color: '#fee2e2', fontWeight: 'bold', textAlign: 'center', fontSize: '0.9rem'}}>
                                      🤒 BOL
                                    </td>
                                  );
                                }

                                const prikaziKraj = smena.kraj && smena.kraj !== smena.pocetak;
                                return (
                                  <td key={dan.formatirano}>
                                    <div className="table-inputs-group">
                                      <input type="text" value={smena.pocetak || ''} onChange={(e) => sacuvajSmenu(radnik.id, dan.formatirano, e.target.value, smena.kraj || '')} placeholder="08:00" />
                                      <input type="text" value={prikaziKraj ? smena.kraj : ''} onChange={(e) => sacuvajSmenu(radnik.id, dan.formatirano, smena.pocetak || '', e.target.value)} placeholder="16:00" />
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

              {/* === POSTAVKE (PUNA VERZIJA SA SVIM BONUSIMA I PROCENTIMA) === */}
              {aktivniTab === 'postavke' && (
                <div className="fade-in">
                  <form onSubmit={sacuvajRadnika} className="hr-form" style={{maxWidth:'650px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'0.8rem', background:'#1e293b', padding:'2rem', borderRadius:'8px', color:'white', textAlign:'left'}}>
                    <h3 style={{marginTop:0, borderBottom:'1px solid #334155', paddingBottom:'0.5rem', color:'#38bdf8'}}>{idZaIzmenu ? '📝 Izmena podataka o zaposlenom' : '👤 Dodavanje novog zaposlenog'}</h3>
                    
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Ime:</label>
                        <input name="ime" placeholder="Ime" value={form.ime || ''} onChange={handleInputChange} required style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Prezime:</label>
                        <input name="prezime" placeholder="Prezime" value={form.prezime || ''} onChange={handleInputChange} required style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                    </div>

                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Radna Pozicija:</label>
                        <input name="pozicija" placeholder="Npr. Kuvar, Šank..." value={form.pozicija || ''} onChange={handleInputChange} required style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Satnica (RSD):</label>
                        <input type="number" name="satnica" placeholder="Cena po satu" value={form.satnica || ''} onChange={handleInputChange} required style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                    </div>

                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginTop:'0.5rem', paddingTop:'0.5rem', borderTop:'1px solid #334155'}}>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Noćni rad počinje od:</label>
                        <input name="nocna_pocetak" value={form.nocna_pocetak || ''} onChange={handleInputChange} style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Noćni rad traje do:</label>
                        <input name="nocna_kraj" value={form.nocna_kraj || ''} onChange={handleInputChange} style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                    </div>

                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Noćni bonus (%):</label>
                        <input type="number" name="nocni_bonus" value={form.nocni_bonus || ''} onChange={handleInputChange} style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Praznični bonus (%):</label>
                        <input type="number" name="praznik_bonus" value={form.praznik_bonus || ''} onChange={handleInputChange} style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                    </div>

                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Godišnji odmor (% isplate):</label>
                        <input type="number" name="go_procenat" value={form.go_procenat || ''} onChange={handleInputChange} style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
                      </div>
                      <div>
                        <label style={{fontSize:'0.85rem', color:'#94a3b8'}}>Bolovanje (% isplate):</label>
                        <input type="number" name="bolovanje_procenat" value={form.bolovanje_procenat || ''} onChange={handleInputChange} style={{width:'100%', padding:'0.6rem', marginTop:'0.2rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} />
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

      {/* === MODAL ZA ODSUSTVA === */}
      {prikaziModalOdsustva && selektovaniRadnikOdsustvo && (
        <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', backgroundColor:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', center:'center', justifyContent:'center', zIndex:99999}}>
          <div style={{maxWidth:'450px', width:'90%', background:'#1e293b', padding:'2rem', borderRadius:'12px', color:'white', textAlign:'left', border:'1px solid #334155'}}>
            <h3 style={{marginTop:0, color:'white', borderBottom:'1px solid #334155', paddingBottom:'0.5rem'}}>🌴 Planiranje Odsustva</h3>
            <p style={{color:'#cbd5e1', fontSize:'0.95rem'}}>Radnik: <strong style={{color:'#38bdf8'}}>{selektovaniRadnikOdsustvo.ime} {selektovaniRadnikOdsustvo.prezime}</strong></p>
            
            <form onSubmit={procesuirajGrupnoOdsustvo} style={{display:'flex', flexDirection:'column', gap:'1rem', marginTop:'1rem'}}>
              <div>
                <label style={{fontSize:'0.85rem', color:'#94a3b8', display:'block', marginBottom:'0.3rem'}}>Tip odsustva:</label>
                <select value={odsustvoForm.tip} onChange={(e) => setOdsustvoForm({...odsustvoForm, tip: e.target.value})} style={{width:'100%', padding:'0.6rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}}>
                  <option value="GO">🌴 Godišnji Odmor (GO)</option>
                  <option value="BOL">🤒 Bolovanje (BOL)</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:'0.85rem', color:'#94a3b8', display:'block', marginBottom:'0.3rem'}}>Datum od:</label>
                <input type="date" value={odsustvoForm.datumOd} onChange={(e) => setOdsustvoForm({...odsustvoForm, datumOd: e.target.value})} style={{width:'100%', padding:'0.6rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} required />
              </div>
              <div>
                <label style={{fontSize:'0.85rem', color:'#94a3b8', display:'block', marginBottom:'0.3rem'}}>Datum do:</label>
                <input type="date" value={odsustvoForm.datumDo} onChange={(e) => setOdsustvoForm({...odsustvoForm, datumDo: e.target.value})} style={{width:'100%', padding:'0.6rem', background:'#0f172a', color:'white', border:'1px solid #334155', borderRadius:'4px'}} required />
              </div>
              <div style={{display:'flex', gap:'1rem', marginTop:'1rem'}}>
                <button type="submit" style={{flex:1, background:'#b45309', color:'white', border:'none', padding:'0.75rem', borderRadius:'6px', cursor:'pointer', fontWeight:'bold'}}>💾 Upiši u kalendar</button>
                <button type="button" onClick={() => setPrikaziModalOdsustva(false)} style={{background:'#475569', color:'white', border:'none', padding:'0.75rem', borderRadius:'6px', cursor:'pointer'}}>Otkaži</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL ZA MESEČNI IZVEŠTAJ === */}
      {prikaziIzvestaj && izvestaj && (
        <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', backgroundColor:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:99999}}>
          <div style={{maxWidth:'500px', width:'90%', background:'#111827', padding:'2rem', borderRadius:'12px', color:'white', textAlign:'left'}}>
            <h2 style={{marginTop:0, color:'white'}}>Mesečni Obračun Zarade</h2>
            <div style={{color:'#38bdf8', fontSize:'1.4rem', fontWeight:'bold'}}>{izvestaj.imeRadnika}</div>
            <div style={{color:'#94a3b8', fontSize:'0.95rem', marginBottom:'1.5rem'}}>Period: {izvestaj.mesecText} / {izvestaj.godinaText}.</div>
            
            <div style={{background:'#1f2937', padding:'1.2rem', borderRadius:'8px', display:'flex', flexDirection:'column', gap:'0.6rem'}}>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Osnovna satnica:</span> <strong style={{color:'white'}}>{izvestaj.satnica} RSD</strong></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Ukupno sati rada:</span> <strong style={{color:'white'}}>{izvestaj.ukupnoSati} h</strong></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Noćni sati (+{izvestaj.nocniBonus || 0}%):</span> <strong style={{color:'#f43f5e'}}>{izvestaj.nocniSati || 0} h</strong></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Godišnji odmor:</span> <strong style={{color:'#fbbf24'}}>{izvestaj.satiGO || 0} h ({izvestaj.zaradaGO || 0} RSD)</strong></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Bolovanje:</span> <strong style={{color:'#f87171'}}>{izvestaj.satiBolovanje || 0} h ({izvestaj.zaradaBolovanje || 0} RSD)</strong></div>
            </div>

            <div style={{background:'#0284c7', padding:'1.2rem', borderRadius:'8px', textAlign:'center', marginTop:'1.5rem'}}>
              <div style={{fontSize:'0.85rem', letterSpacing:'1px'}}>UKUPNO ZA ISPLATU</div>
              <div style={{fontSize:'2.2rem', fontWeight:'bold', marginTop:'0.2rem'}}>{izvestaj.plata || izvestaj.zaradaOdRada || 0} RSD</div>
            </div>
            <button onClick={()=>setPrikaziIzvestaj(false)} style={{marginTop:'1.5rem', width:'100%', background:'#374151', color:'white', border:'none', padding:'0.75rem', borderRadius:'6px', cursor:'pointer', fontWeight:'bold'}}>Zatvori</button>
          </div>
        </div>
      )}

      {/* === MODAL ZA GODIŠNJI PREGLED === */}
      {prikaziGodisnji && godisnjiIzvestaj && (
        <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', backgroundColor:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:99999}}>
          <div style={{maxWidth:'600px', width:'95%', background:'#1f2937', padding:'2rem', borderRadius:'12px', color:'white', boxShadow:'0 20px 25px -5px rgba(0,0,0,0.5)', border:'1px solid #374151', textAlign:'left'}}>
            <h2 style={{marginTop:0, color:'white', fontSize:'1.6rem', borderBottom:'1px solid #374151', paddingBottom:'0.5rem'}}>Godišnji Izveštaj Zarade ({godisnjiIzvestaj.godina})</h2>
            <div style={{color:'#38bdf8', fontSize:'1.4rem', fontWeight:'bold', margin:'0.5rem 0 1.5rem 0'}}>{godisnjiIzvestaj.imeRadnika}</div>
            
            <div style={{maxHeight:'280px', overflowY:'auto', background:'#111827', borderRadius:'8px', padding:'0.5rem', marginBottom:'1.5rem'}}>
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{borderBottom:'2px solid #374151', color:'#94a3b8', fontSize:'0.85rem', textTransform:'uppercase'}}>
                    <th style={{textAlign:'left', padding:'0.75rem'}}>Mesec</th>
                    <th style={{textAlign:'center', padding:'0.75rem'}}>Ukupno Sati</th>
                    <th style={{textAlign:'right', padding:'0.75rem'}}>Ukupna Isplata</th>
                  </tr>
                </thead>
                <tbody>
                  {godisnjiIzvestaj.poMesecima && godisnjiIzvestaj.poMesecima.map((m, i) => (
                    <tr key={i} style={{borderBottom:'1px solid #1f2937', fontSize:'1rem'}}>
                      <td style={{padding:'0.75rem', textAlign:'left', color:'#ffffff', fontWeight:'500'}}>{MESECI_NAZIVI[m.mesec-1]}</td>
                      <td style={{padding:'0.75rem', textAlign:'center', color:'#cbd5e1'}}>{m.sati || 0} h</td>
                      <td style={{padding:'0.75rem', textAlign:'right', fontWeight:'bold', color:'#34d399'}}>{m.zarada || 0} RSD</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', background:'#111827', padding:'1rem', borderRadius:'8px', textAlign:'center', border:'1px solid #374151'}}>
              <div>
                <div style={{fontSize:'0.75rem', color:'#94a3b8', fontWeight:'bold', textTransform:'uppercase'}}>Sati u godini</div>
                <div style={{fontSize:'1.6rem', fontWeight:'bold', color:'#38bdf8', marginTop:'0.2rem'}}>{godisnjiIzvestaj.ukupnoSatiGodina || 0} h</div>
              </div>
              <div>
                <div style={{fontSize:'0.75rem', color:'#94a3b8', fontWeight:'bold', textTransform:'uppercase'}}>Isplaćeno u godini</div>
                <div style={{fontSize:'1.6rem', fontWeight:'bold', color:'#10b981', marginTop:'0.2rem'}}>{godisnjiIzvestaj.ukupnoZaradaGodina || 0} RSD</div>
              </div>
            </div>

            <button onClick={()=>setPrikaziGodisnji(false)} style={{marginTop:'1.5rem', width:'100%', background:'#ef4444', color:'white', border:'none', padding:'0.8rem', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', fontSize:'1rem'}}>Zatvori Izveštaj</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
