import { useState, useEffect } from 'react';
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

function App() {
  const [isUlogovan, setIsUlogovan] = useState(false);
  const [tipKorisnika, setTipKorisnika] = useState('gost'); 
  const [unosLozinke, setUnosLozinke] = useState('');
  const [greskaLozinka, setGreskaLozinka] = useState(false);
  const [aktivniTab, setAktivniTab] = useState('radnici');

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

  // NOVO STANOVIŠTE ZA GODIŠNJI IZVEŠTAJ
  const [godisnjiIzvestaj, setGodisnjiIzvestaj] = useState(null);
  const [prikaziGodisnji, setPrikaziGodisnji] = useState(false);
  
  const [prikaziKalendar, setPrikaziKalendar] = useState(false);
  const [kalendarRadnikId, setKalendarRadnikId] = useState(null);
  const [novoOdsustvo, setNovoOdsustvo] = useState({ od: '', do: '', tip: 'GO' });

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

  const ucitajPodatke = async () => {
    setUcitavam(true);
    try {
      const podaciRadnici = await fetch(`${API_URL}/zaposleni`).then(res => res.ok ? res.json() : []).catch(() => []);
      const podaciRaspored = await fetch(`${API_URL}/raspored`).then(res => res.ok ? res.json() : []).catch(() => []);
      const podaciOdsustva = await fetch(`${API_URL}/odsustva`).then(res => res.ok ? res.json() : []).catch(() => []);

      setZaposleni(podaciRadnici); setRaspored(podaciRaspored); setOdsustva(podaciOdsustva);
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
    fetch(url, { method: idZaIzmenu ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).then(() => { setForm(POCETNO_STANJE_FORME); setIdZaIzmenu(null); ucitajPodatke(); alert('Sačuvano!'); });
  };

  const pripremiZaIzmenu = (radnik) => {
    setForm({ ...radnik }); setIdZaIzmenu(radnik.id); setAktivniTab('postavke');
  };

  const sacuvajSmenu = (radnikId, datum, pocetak, kraj) => {
    fetch(`${API_URL}/raspored`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zaposleni_id: radnikId, datum, pocetak, kraj }) }).then(() => {
      setRaspored(stari => {
        const ostali = stari.filter(r => !(r.zaposleni_id === radnikId && r.datum === datum));
        return [...ostali, { zaposleni_id: radnikId, datum, pocetak, kraj }];
      });
    });
  };

  const izracunajPlaniraneSateUNedelji = (radnikId) => {
    return raspored.filter(r => r.zaposleni_id === radnikId && trenutnaNedelja.some(n => n.formatirano === r.datum)).reduce((ukupno, smena) => {
      if (!smena.pocetak || ['GO','BOL'].includes(smena.pocetak.toUpperCase())) return ukupno;
      let p = parseInt(smena.pocetak.split(':')[0]); let k = parseInt(smena.kraj.split(':')[0]);
      if (k === 0) k = 24; return ukupno + (k > p ? k - p : 24 - p + k);
    }, 0);
  };

  // POZIV MESEČNOG IZVEŠTAJA (PAMTI SVE MESECE UNAZAD)
  const ucitajMesecniIzvestaj = (radnik) => {
    fetch(`${API_URL}/izvestaj/${radnik.id}?mesec=${izabraniMesec}&godina=${izabranaGodina}`)
      .then(res => res.json())
      .then(podaci => {
        setIzvestaj({ ...podaci, imeRadnika: `${radnik.ime} ${radnik.prezime}`, mesecText: MESECI_NAZIVI[izabraniMesec-1], godinaText: izabranaGodina });
        setPrikaziIzvestaj(true);
      });
  };

  // POZIV GODIŠNJEG IZVEŠTAJA
  const ucitajGodisnjiIzvestaj = (radnik) => {
    fetch(`${API_URL}/godisnji-izvestaj/${radnik.id}?godina=${izabranaGodina}`)
      .then(res => res.json())
      .then(podaci => {
        setGodisnjiIzvestaj({ ...podaci, imeRadnika: `${radnik.ime} ${radnik.prezime}` });
        setPrikaziGodisnji(true);
      });
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
      <header className="app-header">
        <h1>HR Menadžer Pro</h1>
        <button className="btn-logout" onClick={() => setIsUlogovan(false)}>🚪 Odjavi se</button>
      </header>

      <nav className="navbar">
        <button className={`nav-link ${aktivniTab === 'radnici' ? 'active' : ''}`} onClick={() => setAktivniTab('radnici')}>👥 Zaposleni i Izvještaji</button>
        <button className={`nav-link ${aktivniTab === 'planer' ? 'active' : ''}`} onClick={() => setAktivniTab('planer')}>📅 Planer Smena</button>
        {tipKorisnika === 'admin' && <button className={`nav-link ${aktivniTab === 'postavke' ? 'active' : ''}`} onClick={() => setAktivniTab('postavke')}>⚙️ Postavke / Dodaj</button>}
      </nav>

      {/* ODABIR PERIODA ZA PREGLED ISTORIJE (PAMĆENJE SATI) */}
      {aktivniTab === 'radnici' && (
        <div className="history-selector" style={{background:'#1e293b', padding:'1rem', borderRadius:'8px', margin:'1rem auto', maxWidth:'1200px', display:'flex', gap:'1rem', alignItems:'center', justifyContent:'center'}}>
          <label style={{fontWeight:'bold'}}>Izaberi period za obračun:</label>
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

      <main className="tab-content">
        {ucitavam ? <p className="loading">Učitavanje podataka...</p> : (
          <>
            {aktivniTab === 'radnici' && (
              <div className="fade-in">
                <div className="cards-grid">
                  {zaposleni.map((radnik) => radnik && (
                    <div key={radnik.id} className="worker-card">
                      <h2>{radnik.ime} {radnik.prezime}</h2>
                      <div className="worker-role">{radnik.pozicija}</div>
                      
                      <div style={{display:'flex', flexDirection:'column', gap:'0.5rem', marginTop:'1rem'}}>
                        <button onClick={() => ucitajMesecniIzvestaj(radnik)} className="btn-action info" style={{background:'#0284c7'}}>
                          📊 Mesečni Izveštaj ({MESECI_NAZIVI[izabraniMesec-1]})
                        </button>
                        <button onClick={() => ucitajGodisnjiIzvestaj(radnik)} className="btn-action dark" style={{background:'#475569'}}>
                          📅 Godišnji Izveštaj ({izabranaGodina})
                        </button>
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
                <form onSubmit={sacuvajRadnika} className="hr-form" style={{maxWidth:'600px', margin:'0 auto'}}>
                  <input name="ime" placeholder="Ime" value={form.ime} onChange={handleInputChange} required />
                  <input name="prezime" placeholder="Prezime" value={form.prezime} onChange={handleInputChange} required />
                  <input name="pozicija" placeholder="Pozicija" value={form.pozicija} onChange={handleInputChange} required />
                  <input type="number" name="satnica" placeholder="Satnica (RSD)" value={form.satnica} onChange={handleInputChange} required />
                  <button type="submit" className="btn-primary" style={{marginTop:'1rem'}}>Sačuvaj Radnika</button>
                </form>
              </div>
            )}
          </>
        )}
      </main>

      {/* === MODAL ZA MESEČNI IZVEŠTAJ (PAMTI ISTORIJU) === */}
      {prikaziIzvestaj && izvestaj && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:'500px', background:'#111827', padding:'2rem', borderRadius:'12px'}}>
            <h2>Mesečni Obračun Zarade</h2>
            <div style={{color:'#38bdf8', fontSize:'1.2rem', fontWeight:'bold'}}>{izvestaj.imeRadnika}</div>
            <div style={{color:'#94a3b8', fontSize:'0.9rem', marginBottom:'1rem'}}>Period: {izvestaj.mesecText} / {izvestaj.godinaText}.</div>
            
            <div style={{background:'#1f2937', padding:'1rem', borderRadius:'8px', display:'flex', flexDirection:'column', gap:'0.5rem'}}>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Osnovna satnica:</span> <strong>{izvestaj.satnica} RSD</strong></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Ukupno sati rada:</span> <strong>{izvestaj.ukupnoSati} h</strong></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Noćni sati (+{izvestaj.nocniBonus}%):</span> <strong>{izvestaj.nocniSati} h</strong></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Godišnji odmor:</span> <strong>{izvestaj.satiGO} h ({izvestaj.zaradaGO} RSD)</strong></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Bolovanje:</span> <strong>{izvestaj.satiBolovanje} h ({izvestaj.zaradaBolovanje} RSD)</strong></div>
            </div>

            <div style={{background:'#0284c7', padding:'1rem', borderRadius:'8px', textAlign:'center', marginTop:'1rem'}}>
              <div>UKUPNO ZA ISPLATU</div>
              <div style={{fontSize:'2rem', fontWeight:'bold'}}>{izvestaj.plata} RSD</div>
            </div>
            <button onClick={()=>setPrikaziIzvestaj(false)} className="btn-action dark w-100" style={{marginTop:'1rem'}}>Zatvori</button>
          </div>
        </div>
      )}

      {/* === NOVO: MODAL ZA GODIŠNJI PREGLED === */}
      {prikaziGodisnji && godisnjiIzvestaj && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:'600px', background:'#111827', padding:'2rem', borderRadius:'12px'}}>
            <h2>Godišnji Izveštaj Poslovanja ({godisnjiIzvestaj.godina})</h2>
            <div style={{color:'#38bdf8', fontSize:'1.2rem', fontWeight:'bold', marginBottom:'1rem'}}>{godisnjiIzvestaj.imeRadnika}</div>
            
            <div style={{maxHeight:'250px', overflowY:'auto', background:'#1f2937', borderRadius:'8px', padding:'0.5rem', marginBottom:'1rem'}}>
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{borderBottom:'2px solid #374151', textTransform:'uppercase', fontSize:'0.8rem', color:'#94a3b8'}}>
                    <th style={{textAlign:'left', padding:'0.5rem'}}>Mesec</th>
                    <th style={{textAlign:'center', padding:'0.5rem'}}>Sati</th>
                    <th style={{textAlign:'right', padding:'0.5rem'}}>Isplata</th>
                  </tr>
                </thead>
                <tbody>
                  {godisnjiIzvestaj.poMesecima.map((m, i) => (
                    <tr key={i} style={{borderBottom:'1px solid #374151', fontSize:'0.95rem'}}>
                      <td style={{padding:'0.5rem', textAlign:'left'}}>{MESECI_NAZIVI[m.mesec-1]}</td>
                      <td style={{padding:'0.5rem', textAlign:'center', color:'#94a3b8'}}>{m.sati} h</td>
                      <td style={{padding:'0.5rem', textAlign:'right', fontWeight:'bold', color:'#34d399'}}>{m.zarada} RSD</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', background:'#0f172a', padding:'1rem', borderRadius:'8px', textAlign:'center'}}>
              <div>
                <div style={{fontSize:'0.8rem', color:'#94a3b8'}}>UKUPNO SATI / GODINA</div>
                <div style={{fontSize:'1.3rem', fontWeight:'bold', color:'#38bdf8'}}>{godisnjiIzvestaj.ukupnoSatiGodina} h</div>
              </div>
              <div>
                <div style={{fontSize:'0.8rem', color:'#94a3b8'}}>UKUPNO ISPLAĆENO / GODINA</div>
                <div style={{fontSize:'1.3rem', fontWeight:'bold', color:'#10b981'}}>{godisnjiIzvestaj.ukupnoZaradaGodina} RSD</div>
              </div>
            </div>

            <button onClick={()=>setPrikaziGodisnji(false)} className="btn-action dark w-100" style={{marginTop:'1.5rem', background:'#374151'}}>Zatvori godišnji izveštaj</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
