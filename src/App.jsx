import { useState, useEffect } from 'react';
import './App.css';
// Uvoz biblioteka za eksport fajlova
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';

// Podešeno na tvoj lokalni server na računaru
const API_URL = 'http://localhost:3000';
const DANI_NAZIVI = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];

// Tvoja tajna menadžerska lozinka
const LOZINKA_ZA_PRISTUP = 'menadzer2026';

const POCETNO_STANJE_FORME = {
  ime: '', prezime: '', pozicija: '', satnica: '',
  nocna_pocetak: '22:00', nocna_kraj: '06:00', nocni_bonus: '26',
  praznik_bonus: '110', go_procenat: '100', bolovanje_procenat: '65'
};

function App() {
  // --- LOGIN STATE ---
  const [isUlogovan, setIsUlogovan] = useState(false);
  const [unosLozinke, setUnosLozinke] = useState('');
  const [greskaLozinka, setGreskaLozinka] = useState(false);

  // --- STATE ZA NAVIGACIJU ---
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

  // MAKSIMALNO BEZBEDNO UCITAVANJE KOJE SPREČAVA PAD NA .MAP()
  const ucitajPodatke = async () => {
    try {
      const [resZaposleni, resRaspored, resOdsustva] = await Promise.all([
        fetch(`${API_URL}/zaposleni`),
        fetch(`${API_URL}/raspored`),
        fetch(`${API_URL}/odsustva`)
      ]);
      
      const podaciZaposleni = await resZaposleni.json();
      const podaciRaspored = await resRaspored.json();
      const podaciOdsustva = await resOdsustva.json();

      // Provera da li su vraćeni nizovi kako ne bi došlo do pucanja aplikacije
      setZaposleni(Array.isArray(podaciZaposleni) ? podaciZaposleni : []);
      setRaspored(Array.isArray(podaciRaspored) ? podaciRaspored : []);
      setOdsustva(Array.isArray(podaciOdsustva) ? podaciOdsustva : []);
    } catch (err) {
      console.error("Greška pri komunikaciji sa serverom:", err);
      setZaposleni([]);
      setRaspored([]);
      setOdsustva([]);
    } finally {
      setUcitavam(false);
    }
  };

  useEffect(() => { 
    if (isUlogovan) {
      ucitajPodatke(); 
    }
  }, [isUlogovan]);

  const proveriLozinku = (e) => {
    e.preventDefault();
    if (unosLozinke === LOZINKA_ZA_PRISTUP) {
      setIsUlogovan(true);
      setGreskaLozinka(false);
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
      setForm(POCETNO_STANJE_FORME); 
      setIdZaIzmenu(null); 
      ucitajPodatke(); 
      alert('Podaci o radniku uspešno sačuvani!');
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const obrisiRadnika = (id) => {
    if (window.confirm("Da li sigurno želite da obrišete radnika?")) {
      fetch(`${API_URL}/zaposleni/${id}`, { method: 'DELETE' }).then(() => ucitajPodatke());
    }
  };

  const sacuvajOdsustvo = (e) => {
    e.preventDefault();
    fetch(`${API_URL}/odsustva`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        zaposleni_id: kalendarRadnikId, 
        datum_od: novoOdsustvo.od, 
        datum_do: novoOdsustvo.do, 
        tip: novoOdsustvo.tip 
      })
    }).then(() => {
      alert('Odsustvo uspešno upisano!');
      ucitajPodatke();
      setPrikaziKalendar(false);
      setNovoOdsustvo({ od: '', do: '', tip: 'GO' });
    });
  };

  const proveriPreklapanjeOdsustva = (radnikId, datumString) => {
    const targetDatum = new Date(datumString);
    targetDatum.setHours(0, 0, 0, 0);

    const aktivnoOdsustvo = odsustva.find(o => {
      if (o.zaposleni_id !== radnikId) return false;
      const odDat = new Date(o.datum_od); odDat.setHours(0, 0, 0, 0);
      const doDat = new Date(o.datum_do); doDat.setHours(0, 0, 0, 0);
      return targetDatum >= odDat && targetDatum <= doDat;
    });

    return aktivnoOdsustvo ? aktivnoOdsustvo.tip : null;
  };

  const sacuvajSmenu = (radnikId, datum, pocetak, kraj) => {
    const tipOdsustva = proveriPreklapanjeOdsustva(radnikId, datum);
    if (tipOdsustva && pocetak !== '' && pocetak.toUpperCase() !== 'GO' && pocetak.toUpperCase() !== 'BOL') {
      if (!window.confirm(`Radnik ima odobren ${tipOdsustva} za taj dan. Upisati smenu uprkos tome?`)) return;
    }

    fetch(`${API_URL}/raspored`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zaposleni_id: radnikId, datum, pocetak, kraj })
    }).then(() => {
      setRaspored(stari => {
        const ostali = stari.filter(r => !(r.zaposleni_id === radnikId && r.datum === datum));
        return [...ostali, { zaposleni_id: radnikId, datum, pocetak, kraj }];
      });
    });
  };

  const izracunajPlaniraneSateUNedelji = (radnikId) => {
    return raspored
      .filter(r => r.zaposleni_id === radnikId && trenutnaNedelja.some(n => n.formatirano === r.datum))
      .reduce((ukupno, smena) => {
        if (!smena.pocetak || !smena.kraj || ['GO','BOL'].includes(smena.pocetak.toUpperCase())) return ukupno;
        let p = parseInt(smena.pocetak.split(':')[0]);
        let k = parseInt(smena.kraj.split(':')[0]);
        if (k === 0) k = 24; 
        return ukupno + (k > p ? k - p : 24 - p + k);
      }, 0);
  };

  const izracunajUkupneSateFirme = () => {
    return zaposleni.reduce((Zbir, radnik) => Zbir + izracunajPlaniraneSateUNedelji(radnik.id), 0);
  };

  const generisiIzvestaj = (id, imePrezime, trazeniMesec, trazenaGodina) => {
    setAktivniRadnik({ id, ime: imePrezime });
    fetch(`${API_URL}/izvestaj/${id}?mesec=${trazeniMesec}&godina=${trazenaGodina}`)
      .then(res => res.json())
      .then(podaci => { 
        setIzvestaj({ ...podaci, imeRadnika: imePrezime }); 
        setPrikaziIzvestaj(true); 
      })
      .catch(() => alert("Greška pri generisanju izveštaja."));
  };

  // --- FUNKCIJA ZA PREUZIMANJE PDF-a ---
  const preuzmiPDFIzvestaj = () => {
    const element = document.getElementById('print-report-area');
    const opt = {
      margin:       [10, 10, 10, 10],
      filename:     `Izvestaj_${izvestaj.imeRadnika.replace(' ', '_')}_${izabraniMesec}_${izabranaGodina}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  // --- FUNKCIJA ZA PREUZIMANJE EXCEL-a (ISPRAVLJENO SVE) ---
  const preuzmiExcelIzvestaj = () => {
    const podaciZaExcel = [
      { "Stavka": "Zaposleni", "Vrednost / Iznos": izvestaj.imeRadnika },
      { "Stavka": "Period", "Vrednost / Iznos": `${izabraniMesec} / ${izabranaGodina}` },
      { "Stavka": "Osnovna satnica", "Vrednost / Iznos": `${izvestaj.satnica} RSD` },
      { "Stavka": "", "Vrednost / Iznos": "" }, 
      { "Stavka": "Odrađeni redovni/noćni sati", "Vrednost / Iznos": `${izvestaj.ukupnoSati} h` },
      { "Stavka": "Od toga noćni rad", "Vrednost / Iznos": `${izvestaj.nocniSati} h` },
      { "Stavka": "ZARADA OD RADA", "Vrednost / Iznos": `${izvestaj.zaradaOdRada} RSD` },
      { "Stavka": "", "Vrednost / Iznos": "" },
      { "Stavka": "Sati Godišnjeg odmora (GO)", "Vrednost / Iznos": `${izvestaj.satiGO} h` },
      { "Stavka": "Naknada za GO", "Vrednost / Iznos": `${izvestaj.zaradaGO} RSD` },
      { "Stavka": "", "Vrednost / Iznos": "" },
      { "Stavka": "Sati Bolovanja", "Vrednost / Iznos": `${izvestaj.satiGO || izvestaj.satiBolovanje} h` },
      { "Stavka": "Naknada za Bolovanje", "Vrednost / Iznos": `${izvestaj.zaradaBolovanje} RSD` },
      { "Stavka": "", "Vrednost / Iznos": "" },
      { "Stavka": "UKUPNO ZA ISPLATU", "Vrednost / Iznos": `${izvestaj.plata} RSD` }
    ];

    const worksheet = XLSX.utils.json_to_sheet(podaciZaExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Obracun Zarade");

    worksheet['!cols'] = [{ wch: 30 }, { wch: 25 }];

    XLSX.writeFile(workbook, `Obracun_${izvestaj.imeRadnika.replace(' ', '_')}_${izabraniMesec}_${izabranaGodina}.xlsx`);
  };

  // --- RENDEROVANJE LOGIN EKRANA ---
  if (!isUlogovan) {
    return (
      <div className="login-overlay">
        <div className="login-box">
          <h2>🔒 HR Menadžer Zaštita</h2>
          <p>Unesite menadžersku lozinku za pristup podacima firme.</p>
          <form onSubmit={proveriLozinku}>
            <input 
              type="password" 
              placeholder="Lozinka" 
              value={unosLozinke} 
              onChange={(e) => setUnosLozinke(e.target.value)} 
              required
            />
            {greskaLozinka && <p className="login-error">❌ Pogrešna lozinka. Pokušajte ponovo.</p>}
            <button type="submit" className="btn-primary w-100" style={{marginTop: '1rem'}}>Pristupi aplikaciji</button>
          </form>
        </div>
      </div>
    );
  }

  // --- GLAVNA APLIKACIJA ---
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>HR Menadžer Pro</h1>
        <p>Sistem za planiranje rada i automatski obračun</p>
        <button className="btn-logout" onClick={() => { setIsUlogovan(false); setUnosLozinke(''); }}>🚪 Odjavi se</button>
      </header>

      <nav className="navbar">
        <button className={`nav-link ${aktivniTab === 'radnici' ? 'active' : ''}`} onClick={() => setAktivniTab('radnici')}>
          👥 Zaposleni
        </button>
        <button className={`nav-link ${aktivniTab === 'planer' ? 'active' : ''}`} onClick={() => setAktivniTab('planer')}>
          📅 Planer Smena
        </button>
        <button className={`nav-link ${aktivniTab === 'postavke' ? 'active' : ''}`} onClick={() => setAktivniTab('postavke')}>
          ⚙️ Postavke
        </button>
      </nav>

      <main className="tab-content">
        {ucitavam ? <p className="loading">Učitavanje podataka...</p> : (
          <>
            {/* === TAB 1: ZAPOSLENI === */}
            {aktivniTab === 'radnici' && (
              <div className="fade-in">
                <div className="section-header-box">
                  <h2>Spisak Zaposlenih</h2>
                  <p>Pregled radnika, prijava odsustva i obračun plata na osnovu planera</p>
                </div>
                
                <div className="cards-grid">
                  {zaposleni.map((radnik) => (
                    <div key={radnik.id} className="worker-card">
                      <h2>{radnik.ime} {radnik.prezime}</h2>
                      <div className="worker-role">{radnik.pozicija}</div>
                      
                      <button onClick={() => { setKalendarRadnikId(radnik.id); setPrikaziKalendar(true); }} className="btn-action info">
                        📅 Evidencija Odsustva (GO/BOL)
                      </button>
                      
                      <button onClick={() => generisiIzvestaj(radnik.id, `${radnik.ime} ${radnik.prezime}`, izabraniMesec, izabranaGodina)} className="btn-action dark">
                        📊 Obračunaj platu
                      </button>

                      <div className="card-footer-buttons">
                        <button onClick={() => pripremiZaIzmenu(radnik)} className="btn-outline info">Izmeni</button>
                        <button onClick={() => obrisiRadnika(radnik.id)} className="btn-outline danger">Obriši</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* === TAB 2: PLANER === */}
            {aktivniTab === 'planer' && (
              <div className="fade-in">
                <div className="table-container">
                  <div className="table-header-row">
                    <div>
                      <h2>Nedeljni planer smena</h2>
                      <p style={{margin:0, fontSize:'0.9rem', color:'var(--text-muted)'}}>Upišite vreme rada (npr. 08:00 i 16:00) ili oznake 'GO' / 'BOL'</p>
                    </div>
                  </div>
                  <div className="scrollable-table">
                    <table>
                      <thead>
                        <tr>
                          <th className="text-left">Zaposleni</th>
                          {trenutnaNedelja.map(dan => (
                            <th key={dan.formatirano}>{dan.naziv} <br/><small style={{color:'#94a3b8'}}>{dan.formatirano.split('-')[2]}.{dan.formatirano.split('-')[1]}</small></th>
                          ))}
                          <th>Sati ove nedelje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {zaposleni.map(radnik => {
                          return (
                            <tr key={`planer-${radnik.id}`}>
                              <td className="text-left font-light">{radnik.ime} {radnik.prezime}</td>
                              
                              {trenutnaNedelja.map(dan => {
                                const smena = raspored.find(r => r.zaposleni_id === radnik.id && r.datum === dan.formatirano) || { pocetak: '', kraj: '' };
                                const valPocetak = (smena.pocetak || '').toUpperCase();
                                const imaOdsustvo = proveriPreklapanjeOdsustva(radnik.id, dan.formatirano);
                                
                                let klasaBoje = 'text-white';
                                if (valPocetak === 'GO' || imaOdsustvo === 'GO') klasaBoje = 'text-yellow';
                                if (valPocetak === 'BOL' || imaOdsustvo === 'BOLOVANJE') klasaBoje = 'text-red';
                                
                                return (
                                  <td key={dan.formatirano}>
                                    <div className="table-inputs-group">
                                      <input 
                                        type="text" 
                                        value={smena.pocetak || ''} 
                                        onChange={(e) => sacuvajSmenu(radnik.id, dan.formatirano, e.target.value, smena.kraj)} 
                                        placeholder={imaOdsustvo ? imaOdsustvo : "08:00"} 
                                        className={`${klasaBoje}`} 
                                      />
                                      <input 
                                        type="text" 
                                        value={smena.kraj || ''} 
                                        onChange={(e) => sacuvajSmenu(radnik.id, dan.formatirano, smena.pocetak, e.target.value)} 
                                        placeholder={imaOdsustvo ? "SLOB" : "16:00"} 
                                        className={`${klasaBoje}`} 
                                      />
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="font-bold">{izracunajPlaniraneSateUNedelji(radnik.id)} h</td>
                            </tr>
                          );
                        })}
                        
                        <tr className="table-summary-row">
                          <td className="text-left font-bold text-sky">Ukupno firma (Ove nedelje):</td>
                          {trenutnaNedelja.map(dan => <td key={`prazno-${dan.formatirano}`}></td>)}
                          <td className="font-bold text-sky">{izracunajUkupneSateFirme()} h</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* === TAB 3: POSTAVKE === */}
            {aktivniTab === 'postavke' && (
              <div className="fade-in">
                <form onSubmit={sacuvajRadnika} className="hr-form">
                  <h3>{idZaIzmenu ? 'Izmena podataka radnika' : 'Dodaj novog zaposlenog u firmu'}</h3>
                  <div className="form-row">
                    <input name="ime" placeholder="Ime" value={form.ime} onChange={handleInputChange} required />
                    <input name="prezime" placeholder="Prezime" value={form.prezime} onChange={handleInputChange} required />
                    <input name="pozicija" placeholder="Pozicija" value={form.pozicija} onChange={handleInputChange} required />
                  </div>
                  
                  <div className="form-section">
                    <div className="section-item">
                      <label>Satnica (RSD):</label>
                      <input type="number" name="satnica" value={form.satnica} onChange={handleInputChange} required className="input-small" />
                    </div>
                    <div className="section-item">
                      <label>Noćna smena od:</label>
                      <input type="time" name="nocna_pocetak" value={form.nocna_pocetak} onChange={handleInputChange} />
                    </div>
                    <div className="section-item">
                      <label>do:</label>
                      <input type="time" name="nocna_kraj" value={form.nocna_kraj} onChange={handleInputChange} />
                    </div>
                  </div>
                  
                  <div className="form-section grid-4">
                    <div className="section-item">
                      <label>Noćni bonus (%):</label>
                      <input type="number" name="nocni_bonus" value={form.nocni_bonus} onChange={handleInputChange} />
                    </div>
                    <div className="section-item">
                      <label>Praznik bonus (%):</label>
                      <input type="number" name="praznik_bonus" value={form.praznik_bonus} onChange={handleInputChange} />
                    </div>
                    <div className="section-item">
                      <label>Godišnji odmor (%):</label>
                      <input type="number" name="go_procenat" value={form.go_procenat} onChange={handleInputChange} />
                    </div>
                    <div className="section-item">
                      <label>Bolovanje (%):</label>
                      <input type="number" name="bolovanje_procenat" value={form.bolovanje_procenat} onChange={handleInputChange} />
                    </div>
                  </div>
                  
                  <div className="form-buttons">
                    <button type="submit" className="btn-primary">Sačuvaj radnika</button>
                    {idZaIzmenu && (
                      <button type="button" className="btn-secondary" onClick={() => { setForm(POCETNO_STANJE_FORME); setIdZaIzmenu(null); }}>
                        Odustani
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </main>

      {/* --- MODAL ZA KALENDAR ODSUSTVA --- */}
      {prikaziKalendar && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Prijava odsustva</h2>
            <form onSubmit={sacuvajOdsustvo} className="modal-form">
              <div>
                <label>Tip odsustva:</label>
                <select name="tip" value={novoOdsustvo.tip} onChange={(e)=>setNovoOdsustvo({...novoOdsustvo, tip: e.target.value})}>
                  <option value="GO">Godišnji odmor</option>
                  <option value="BOLOVANJE">Bolovanje</option>
                </select>
              </div>
              <div>
                <label>Od datuma:</label>
                <input type="date" name="od" required value={novoOdsustvo.od} onChange={(e)=>setNovoOdsustvo({...novoOdsustvo, od: e.target.value})} />
              </div>
              <div>
                <label>Do datuma:</label>
                <input type="date" name="do" required value={novoOdsustvo.do} onChange={(e)=>setNovoOdsustvo({...novoOdsustvo, do: e.target.value})} />
              </div>
              <div className="modal-buttons">
                <button type="submit" className="btn-action info">Sačuvaj</button>
                <button type="button" className="btn-action dark" onClick={() => setPrikaziKalendar(false)}>Zatvori</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL ZA IZVEŠTAJ ZARADE --- */}
      {prikaziIzvestaj && izvestaj && (
        <div className="modal-overlay">
          <div className="modal-content scrollable-y">
            
            <div id="print-report-area" style={{ padding: '10px', background: '#1e293b', borderRadius: '8px' }}>
              <h2>Automatski Izveštaj Zarade</h2>
              <div className="modal-subtitle">{izvestaj.imeRadnika}</div>

              <div className="modal-filters" data-html2canvas-ignore="true">
                <select value={izabraniMesec} onChange={(e) => { setIzabraniMesec(e.target.value); generisiIzvestaj(aktivniRadnik.id, aktivniRadnik.ime, e.target.value, izabranaGodina); }}>
                  <option value="1">Januar</option><option value="2">Februar</option><option value="3">Mart</option><option value="4">April</option>
                  <option value="5">Maj</option><option value="6">Jun</option><option value="7">Jul</option><option value="8">Avgust</option>
                  <option value="9">Septembar</option><option value="10">Oktobar</option><option value="11">Novembar</option><option value="12">Decembar</option>
                </select>
                <select value={izabranaGodina} onChange={(e) => { setIzabranaGodina(e.target.value); generisiIzvestaj(aktivniRadnik.id, aktivniRadnik.ime, izabraniMesec, e.target.value); }}>
                  <option value="2025">2025</option><option value="2026">2026</option>
                </select>
              </div>

              <div className="report-block">
                <div className="report-row"><span className="label">Osnovna satnica:</span><span>{izvestaj.satnica} RSD</span></div>
                <div className="divider"></div>
                <div className="report-row"><span className="label">Odrađeni sati iz planera:</span><span>{izvestaj.ukupnoSati} h</span></div>
                <div className="report-row"><span className="label">Od toga noćni sati:</span><span>{izvestaj.nocniSati} h</span></div>
                <div className="report-row highlight"><span className="font-bold">Zarada od rada:</span><span className="font-bold">{izvestaj.zaradaOdRada} RSD</span></div>
              </div>

              <div className="report-block">
                <h4>Odsustva zabeležena u planeru</h4>
                <div className="report-row"><span className="label">Godišnji odmor ({izvestaj.goProcenat}%):</span><span className="text-yellow">{izvestaj.satiGO} h</span></div>
                <div className="report-row text-yellow"><span className="label">Naknada za GO:</span><span>{izvestaj.zaradaGO} RSD</span></div>
                <div className="divider"></div>
                <div className="report-row"><span className="label">Bolovanje ({izvestaj.bolovanjeProcenat}%):</span><span className="text-red">{izvestaj.satiBolovanje} h</span></div>
                <div className="report-row text-red"><span className="label">Naknada za Bolovanje:</span><span>{izvestaj.zaradaBolovanje} RSD</span></div>
              </div>

              <div className="report-total">
                <div className="total-label">Ukupno za isplatu</div>
                <div className="total-amount">{izvestaj.plata} RSD</div>
              </div>
            </div>

            {/* DUGMIĆI ZA PREUZIMANJE */}
            <div className="export-buttons-group" style={{ display: 'flex', gap: '10px', margin: '15px 0' }}>
              <button onClick={preuzmiPDFIzvestaj} className="btn-action info" style={{ flex: 1, background: '#0284c7' }}>
                📄 Preuzmi PDF
              </button>
              <button onClick={preuzmiExcelIzvestaj} className="btn-action info" style={{ flex: 1, background: '#16a34a' }}>
                📊 Preuzmi Excel
              </button>
            </div>

            <button onClick={() => setPrikaziIzvestaj(false)} className="btn-action dark w-100">Zatvori</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
