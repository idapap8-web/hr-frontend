import { useState, useEffect } from 'react';
import './App.css';

const API_URL = `http://${window.location.hostname}:3000`;
const DANI_NAZIVI = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];

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
  const [aktivniRadnik, setAktivniRadnik] = useState(null);
  
  const [izvestaj, setIzvestaj] = useState(null);
  const [prikaziIzvestaj, setPrikaziIzvestaj] = useState(false);
  
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
      const isoFormat = sledeciDan.toISOString().split('T')[0];
      datumi.push({ naziv: DANI_NAZIVI[i], formatirano: isoFormat });
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

      setZaposleni(Array.isArray(podaciRadnici) ? podaciRadnici : []);
      setRaspored(Array.isArray(podaciRaspored) ? podaciRaspored : []);
      setOdsustva(Array.isArray(podaciOdsustva) ? podaciOdsustva : []);
    } catch (err) {
      console.error("Greška:", err);
    } finally {
      setUcitavam(false);
    }
  };

  useEffect(() => { 
    if (isUlogovan) { ucitajPodatke(); }
  }, [isUlogovan]);

  const proveriLozinku = (e) => {
    e.preventDefault();
    if (unosLozinke === LOZINKA_ADMIN) {
      setTipKorisnika('admin'); setIsUlogovan(true); setGreskaLozinka(false);
    } else if (unosLozinke === LOZINKA_PREGLED) {
      setTipKorisnika('gost'); setIsUlogovan(true); setGreskaLozinka(false);
    } else {
      setGreskaLozinka(true);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(stari => ({ ...stari, [name]: value }));
  };

  const sacuvajRadnika = (e) => {
    e.preventDefault();
    const url = idZaIzmenu ? `${API_URL}/zaposleni/${idZaIzmenu}` : `${API_URL}/zaposleni`;
    fetch(url, { 
      method: idZaIzmenu ? 'PUT' : 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(form) 
    }).then(() => { 
      setForm(POCETNO_STANJE_FORME); setIdZaIzmenu(null); ucitajPodatke(); alert('Uspešno sačuvano!');
    });
  };

  const pripremiZaIzmenu = (radnik) => {
    setForm({
      ime: radnik.ime, prezime: radnik.prezime, pozicija: radnik.pozicija,
      satnica: radnik.satnica || '', nocna_pocetak: radnik.nocna_pocetak || '22:00',
      nocna_kraj: radnik.nocna_kraj || '06:00', nocni_bonus: radnik.nocni_bonus || '26',
      praznik_bonus: radnik.praznik_bonus || '110', go_procenat: radnik.go_procenat || '100',
      bolovanje_procenat: radnik.bolovanje_procenat || '65'
    });
    setIdZaIzmenu(radnik.id);
    setAktivniTab('postavke');
  };

  const obrisiRadnika = (id) => {
    if (window.confirm("Obrisati radnika?")) {
      fetch(`${API_URL}/zaposleni/${id}`, { method: 'DELETE' }).then(() => ucitajPodatke());
    }
  };

  const sacuvajOdsustvo = (e) => {
    e.preventDefault();
    fetch(`${API_URL}/odsustva`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zaposleni_id: kalendarRadnikId, datum_od: novoOdsustvo.od, datum_do: novoOdsustvo.do, tip: novoOdsustvo.tip })
    }).then(() => {
      alert('Odsustvo zabeleženo!'); ucitajPodatke(); setPrikaziKalendar(false);
    });
  };

  const proveriPreklapanjeOdsustva = (radnikId, datumString) => {
    if (!Array.isArray(odsustva)) return null;
    const targetDatum = new Date(datumString); targetDatum.setHours(0,0,0,0);
    const aktivno = odsustva.find(o => {
      if (!o || o.zaposleni_id !== radnikId) return false;
      const odD = new Date(o.datum_od); odD.setHours(0,0,0,0);
      const doD = new Date(o.datum_do); doD.setHours(0,0,0,0);
      return targetDatum >= odD && targetDatum <= doD;
    });
    return aktivno ? aktivno.tip : null;
  };

  const sacuvajSmenu = (radnikId, datum, pocetak, kraj) => {
    fetch(`${API_URL}/raspored`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zaposleni_id: radnikId, datum, pocetak, kraj })
    }).then(() => {
      setRaspored(stari => {
        const ostali = (stari || []).filter(r => !(r && r.zaposleni_id === radnikId && r.datum === datum));
        return [...ostali, { zaposleni_id: radnikId, datum, pocetak, kraj }];
      });
    });
  };

  const izracunajPlaniraneSateUNedelji = (radnikId) => {
    if (!Array.isArray(raspored)) return 0;
    return raspored
      .filter(r => r && r.zaposleni_id === radnikId && trenutnaNedelja.some(n => n.formatirano === r.datum))
      .reduce((ukupno, smena) => {
        if (!smena || !smena.pocetak || !smena.kraj || ['GO','BOL'].includes(smena.pocetak.toUpperCase())) return ukupno;
        let p = parseInt(smena.pocetak.split(':')[0]); let k = parseInt(smena.kraj.split(':')[0]);
        if (k === 0) k = 24; return ukupno + (k > p ? k - p : 24 - p + k);
      }, 0);
  };

  const generisiIzvestaj = (radnik, trazeniMesec, trazenaGodina) => {
    setAktivniRadnik({ id: radnik.id, ime: `${radnik.ime} ${radnik.prezime}` });
    
    fetch(`${API_URL}/izvestaj/${radnik.id}?mesec=${trazeniMesec}&godina=${trazenaGodina}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(podaci => { 
        setIzvestaj({ ...podaci, imeRadnika: `${radnik.ime} ${radnik.prezime}` }); 
        setPrikaziIzvestaj(true); 
      })
      .catch(() => {
        // Rezervna računica na frontu ako server uspori
        const satnica = parseFloat(radnik.satnica || 300);
        const sati = izracunajPlaniraneSateUNedelji(radnik.id) * 4;
        setIzvestaj({
          satnica, ukupnoSati: sati, nocniSati: 0, praznicniSati: 0, satiGO: 0, satiBolovanje: 0,
          goProcenat: radnik.go_procenat, bolovanjeProcenat: radnik.bolovanje_procenat, nocniBonus: radnik.nocni_bonus,
          zaradaOdRada: sati * satnica, zaradaGO: 0, zaradaBolovanje: 0, plata: sati * satnica,
          imeRadnika: `${radnik.ime} ${radnik.prezime}`
        });
        setPrikaziIzvestaj(true);
      });
  };

  if (!isUlogovan) {
    return (
      <div className="login-overlay">
        <div className="login-box">
          <h2>🔒 HR Menadžer Zaštita</h2>
          <form onSubmit={proveriLozinku}>
            <input type="password" placeholder="Lozinka" value={unosLozinke} onChange={(e) => setUnosLozinke(e.target.value)} required />
            <button type="submit" className="btn-primary w-100" style={{marginTop: '1rem'}}>Pristupi</button>
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
        <button className={`nav-link ${aktivniTab === 'radnici' ? 'active' : ''}`} onClick={() => setAktivniTab('radnici')}>👥 Zaposleni</button>
        <button className={`nav-link ${aktivniTab === 'planer' ? 'active' : ''}`} onClick={() => setAktivniTab('planer')}>📅 Planer Smena</button>
        {tipKorisnika === 'admin' && <button className={`nav-link ${aktivniTab === 'postavke' ? 'active' : ''}`} onClick={() => setAktivniTab('postavke')}>⚙️ Postavke / Dodaj</button>}
      </nav>

      <main className="tab-content">
        {ucitavam ? <p className="loading">Učitavanje podataka...</p> : (
          <>
            {/* === TAB RADNICI === */}
            {aktivniTab === 'radnici' && (
              <div className="fade-in">
                <div className="cards-grid">
                  {zaposleni.map((radnik) => radnik && (
                    <div key={radnik.id} className="worker-card">
                      <h2>{radnik.ime} {radnik.prezime}</h2>
                      <div className="worker-role">{radnik.pozicija}</div>
                      <div style={{fontSize:'0.9rem', color:'#94a3b8', margin:'0.5rem 0'}}>Satnica: {radnik.satnica} RSD | Noćni rad: +{radnik.nocni_bonus}%</div>
                      
                      <div className="card-footer-buttons" style={{marginTop:'1rem'}}>
                        <button onClick={() => { setKalendarRadnikId(radnik.id); setPrikaziKalendar(true); }} className="btn-outline info">📅 Odsustvo</button>
                        <button onClick={() => generisiIzvestaj(radnik, izabraniMesec, izabranaGodina)} className="btn-action dark">📊 Obračun plate</button>
                      </div>

                      {tipKorisnika === 'admin' && (
                        <div className="card-footer-buttons" style={{marginTop:'0.5rem'}}>
                          <button onClick={() => pripremiZaIzmenu(radnik)} className="btn-outline info" style={{borderColor:'#10b981', color:'#10b981'}}>Izmeni</button>
                          <button onClick={() => obrisiRadnika(radnik.id)} className="btn-outline danger">Obriši</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* === TAB PLANER === */}
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
                          <tr key={`planer-${radnik.id}`}>
                            <td className="text-left font-light">{radnik.ime} {radnik.prezime}</td>
                            {trenutnaNedelja.map(dan => {
                              const smena = (raspored || []).find(r => r && r.zaposleni_id === radnik.id && r.datum === dan.formatirano) || { pocetak: '', kraj: '' };
                              const imaOdsustvo = proveriPreklapanjeOdsustva(radnik.id, dan.formatirano);
                              return (
                                <td key={dan.formatirano}>
                                  <div className="table-inputs-group">
                                    <input type="text" value={smena.pocetak || ''} onChange={(e) => sacuvajSmenu(radnik.id, dan.formatirano, e.target.value, smena.kraj)} placeholder={imaOdsustvo ? imaOdsustvo : "08:00"} />
                                    <input type="text" value={smena.kraj || ''} onChange={(e) => sacuvajSmenu(radnik.id, dan.formatirano, smena.pocetak, e.target.value)} placeholder={imaOdsustvo ? "SLOB" : "16:00"} />
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

            {/* === TAB POSTAVKE (POTPUNA FORMA) === */}
            {aktivniTab === 'postavke' && (
              <div className="fade-in">
                <form onSubmit={sacuvajRadnika} className="hr-form" style={{maxWidth:'700px', margin:'0 auto'}}>
                  <h3>{idZaIzmenu ? 'Izmeni podatke o radniku' : 'Dodaj novog radnika u sistem'}</h3>
                  
                  <div className="form-row">
                    <input name="ime" placeholder="Ime" value={form.ime} onChange={handleInputChange} required />
                    <input name="prezime" placeholder="Prezime" value={form.prezime} onChange={handleInputChange} required />
                    <input name="pozicija" placeholder="Pozicija" value={form.pozicija} onChange={handleInputChange} required />
                  </div>
                  
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem', marginTop:'1rem'}}>
                    <div>
                      <label>Satnica (RSD):</label>
                      <input type="number" name="satnica" value={form.satnica} onChange={handleInputChange} required />
                    </div>
                    <div>
                      <label>Noćna počinje od:</label>
                      <input type="time" name="nocna_pocetak" value={form.nocna_pocetak} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label>Noćna traje do:</label>
                      <input type="time" name="nocna_kraj" value={form.nocna_kraj} onChange={handleInputChange} />
                    </div>
                  </div>

                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'1rem', marginTop:'1rem'}}>
                    <div>
                      <label>Noćni bonus (%):</label>
                      <input type="number" name="nocni_bonus" value={form.nocni_bonus} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label>Praznik bonus (%):</label>
                      <input type="number" name="praznik_bonus" value={form.praznik_bonus} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label>Godišnji odmor (%):</label>
                      <input type="number" name="go_procenat" value={form.go_procenat} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label>Bolovanje (%):</label>
                      <input type="number" name="bolovanje_procenat" value={form.bolovanje_procenat} onChange={handleInputChange} />
                    </div>
                  </div>

                  <div style={{marginTop:'1.5rem', display:'flex', gap:'1rem'}}>
                    <button type="submit" className="btn-primary">Sačuj profil radnika</button>
                    {idZaIzmenu && <button type="button" className="btn-secondary" onClick={() => { setForm(POCETNO_STANJE_FORME); setIdZaIzmenu(null); }}>Odustani</button>}
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL ZA ODSUSTVA */}
      {prikaziKalendar && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Evidencija Odsustva</h2>
            <form onSubmit={sacuvajOdsustvo} className="modal-form">
              <select value={novoOdsustvo.tip} onChange={(e)=>setNovoOdsustvo({...novoOdsustvo, tip: e.target.value})}>
                <option value="GO">Godišnji odmor (GO)</option>
                <option value="BOLOVANJE">Bolovanje (BOL)</option>
              </select>
              <input type="date" required value={novoOdsustvo.od} onChange={(e)=>setNovoOdsustvo({...novoOdsustvo, od: e.target.value})} />
              <input type="date" required value={novoOdsustvo.do} onChange={(e)=>setNovoOdsustvo({...novoOdsustvo, do: e.target.value})} />
              <div className="modal-buttons">
                <button type="submit" className="btn-action info">Upiši</button>
                <button type="button" className="btn-action dark" onClick={() => setPrikaziKalendar(false)}>Zatvori</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === KOMPLETAN I DETALJAN MODAL ZA IZVEŠTAJ ZARADE === */}
      {prikaziIzvestaj && izvestaj && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:'550px', background:'#111827', color:'white', borderRadius:'12px', padding:'2rem'}}>
            <h2 style={{margin:0, fontSize:'1.6rem'}}>Automatski Obračun Plate</h2>
            <div style={{fontSize: '1.3rem', fontWeight: 'bold', color: '#38bdf8', marginBottom: '1.5rem'}}>{izvestaj.imeRadnika}</div>
            
            <div style={{display:'flex', flexDirection:'column', gap:'0.6rem', background:'#1f2937', padding:'1.2rem', borderRadius:'8px', marginBottom:'1rem'}}>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Osnovna satnica:</span> <strong>{izvestaj.satnica} RSD</strong></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Ukupno odrađeno sati:</span> <strong>{izvestaj.ukupnoSati} h</strong></div>
              <div style={{display:'flex', justifyContent:'space-between', color:'#f43f5e'}}><span>Od toga noćni sati (+{izvestaj.nocniBonus}%):</span> <strong>{izvestaj.nocniSati} h</strong></div>
              <div style={{display:'flex', justifyContent:'space-between', color:'#34d399'}}><span>Praznični sati (+{izvestaj.praznikBonus}%):</span> <strong>{izvestaj.praznicniSati} h</strong></div>
              <div style={{height:'1px', background:'#374151', margin:'0.3rem 0'}}></div>
              <div style={{display:'flex', justifyContent:'space-between', fontWeight:'bold'}}><span>Zarada od rada:</span> <span>{izvestaj.zaradaOdRada} RSD</span></div>
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:'0.6rem', background:'#1f2937', padding:'1.2rem', borderRadius:'8px', marginBottom:'1.5rem'}}>
              <div style={{display:'flex', justifyContent:'space-between', color:'#fbbf24'}}><span>Godišnji odmor ({izvestaj.goProcenat}%):</span> <strong>{izvestaj.satiGO} h ({izvestaj.zaradaGO} RSD)</strong></div>
              <div style={{display:'flex', justifyContent:'space-between', color:'#f87171'}}><span>Bolovanje ({izvestaj.bolovanjeProcenat}%):</span> <strong>{izvestaj.satiBolovanje} h ({izvestaj.zaradaBolovanje} RSD)</strong></div>
            </div>

            <div style={{background: '#0284c7', padding: '1.2rem', borderRadius: '8px', textAlign: 'center'}}>
              <div style={{textTransform: 'uppercase', fontSize: '0.85rem', opacity: 0.9, letterSpacing:'1px'}}>Ukupno za isplatu</div>
              <div style={{fontSize: '2.3rem', fontWeight: 'bold', marginTop:'0.2rem'}}>{izvestaj.plata} RSD</div>
            </div>

            <button onClick={() => setPrikaziIzvestaj(false)} className="btn-action dark w-100" style={{marginTop: '1.5rem', background:'#374151'}}>Zatvori obračun</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
