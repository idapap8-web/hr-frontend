import { useState, useEffect } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const DANI_U_NEDELJI = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];

const POCETNO_STANJE_FORME = {
  ime: '', prezime: '', pozicija: '', satnica: '',
  nocna_pocetak: '22:00', nocna_kraj: '06:00', nocni_bonus: '26',
  praznik_bonus: '110', go_procenat: '100', bolovanje_procenat: '65'
};

function App() {
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

  const ucitajPodatke = async () => {
    try {
      const [resZaposleni, resRaspored, resOdsustva] = await Promise.all([
        fetch(`${API_URL}/zaposleni`),
        fetch(`${API_URL}/raspored`),
        fetch(`${API_URL}/odsustva`)
      ]);
      setZaposleni(await resZaposleni.json());
      setRaspored(await resRaspored.json());
      setOdsustva(await resOdsustva.json());
    } catch (err) {
      console.error("Greška pri učitavanju:", err);
    } finally {
      setUcitavam(false);
    }
  };

  useEffect(() => { ucitajPodatke(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(stari => ({ ...stari, [name]: value }));
  };

  const handleOdsustvoChange = (e) => {
    const { name, value } = e.target;
    setNovoOdsustvo(stari => ({ ...stari, [name]: value }));
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
      alert('Odsustvo sačuvano');
      ucitajPodatke();
      setPrikaziKalendar(false);
      setNovoOdsustvo({ od: '', do: '', tip: 'GO' });
    });
  };

  const obrisiOdsustvo = (id) => {
    fetch(`${API_URL}/odsustva/${id}`, { method: 'DELETE' }).then(() => ucitajPodatke());
  };

  const proveriPreklapanjeOdsustva = (radnikId, dan) => {
    const indeksDana = DANI_U_NEDELJI.indexOf(dan);
    if (indeksDana === -1) return null;

    const danas = new Date();
    const trenutniIndeks = danas.getDay() === 0 ? 6 : danas.getDay() - 1; 
    const razlika = indeksDana - trenutniIndeks;
    
    const targetDatum = new Date(danas);
    targetDatum.setDate(danas.getDate() + razlika);
    targetDatum.setHours(0, 0, 0, 0);

    const aktivnoOdsustvo = odsustva.find(o => {
      if (o.zaposleni_id !== radnikId) return false;
      const odDat = new Date(o.datum_od); odDat.setHours(0, 0, 0, 0);
      const doDat = new Date(o.datum_do); doDat.setHours(0, 0, 0, 0);
      return targetDatum >= odDat && targetDatum <= doDat;
    });

    return aktivnoOdsustvo ? aktivnoOdsustvo.tip : null;
  };

  const sacuvajSmenu = (radnikId, dan, pocetak, kraj) => {
    const tipOdsustva = proveriPreklapanjeOdsustva(radnikId, dan);
    if (tipOdsustva && pocetak !== '' && pocetak.toUpperCase() !== 'GO' && pocetak.toUpperCase() !== 'BOL') {
      if (!window.confirm(`Upozorenje: Radnik ima odobren ${tipOdsustva} za ovaj dan. Da li i pored toga želite da upišete smenu?`)) {
        return;
      }
    }

    setRaspored(stari => {
      const ostali = stari.filter(r => !(r.zaposleni_id === radnikId && r.dan === dan));
      return [...ostali, { zaposleni_id: radnikId, dan, pocetak, kraj }];
    });

    fetch(`${API_URL}/raspored`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zaposleni_id: radnikId, dan, pocetak, kraj })
    });
  };

  const kopirajProsluNedelju = () => {
    if (window.confirm("Da li želite da kopirate trenutni raspored kao osnovu?")) {
      alert("Raspored uspešno dupliciran za naredni period!");
      ucitajPodatke();
    }
  };

  const izracunajPlaniraneSate = (radnikId) => {
    return raspored
      .filter(r => r.zaposleni_id === radnikId)
      .reduce((ukupno, smena) => {
        if (!smena.pocetak || !smena.kraj || isNaN(parseInt(smena.pocetak)) || isNaN(parseInt(smena.kraj))) {
          return ukupno;
        }
        let p = parseInt(smena.pocetak.split(':')[0]);
        let k = parseInt(smena.kraj.split(':')[0]);
        if (k === 0) k = 24; 
        return ukupno + (k > p ? k - p : 24 - p + k);
      }, 0);
  };

  const izracunajUkupneSateFirme = () => {
    return zaposleni.reduce((Zbir, radnik) => Zbir + izracunajPlaniraneSate(radnik.id), 0);
  };

  const evidencijaDolazak = (id) => fetch(`${API_URL}/evidencija/dolazak`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zaposleni_id: id }) }).then(() => alert('Dolazak evidentiran'));
  const AnalyticsOdlazak = (id) => fetch(`${API_URL}/evidencija/odlazak`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zaposleni_id: id }) }).then(() => alert('Odlazak evidentiran'));

  const generisiIzvestaj = (id, imePrezime, trazeniMesec, trazenaGodina) => {
    setAktivniRadnik({ id, ime: imePrezime });
    fetch(`${API_URL}/izvestaj/${id}?mesec=${trazeniMesec}&godina=${trazenaGodina}`)
      .then(res => res.json())
      .then(podaci => { 
        setIzvestaj({ ...podaci, imeRadnika: imePrezime }); 
        setPrikaziIzvestaj(true); 
      })
      .catch(() => alert("Greška pri učitavanju izveštaja."));
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>HR Menadžment</h1>
        <p>Evidencija i raspored rada</p>
      </header>

      <form onSubmit={sacuvajRadnika} className="hr-form">
        <h3>{idZaIzmenu ? 'Izmena podataka' : 'Novi zaposleni'}</h3>
        <div className="form-row">
          <input name="ime" placeholder="Ime" value={form.ime} onChange={handleInputChange} required />
          <input name="prezime" placeholder="Prezime" value={form.prezime} onChange={handleInputChange} required />
          <input name="pozicija" placeholder="Pozicija" value={form.pozicija} onChange={handleInputChange} required />
        </div>
        
        <div className="form-section">
          <div className="section-item">
            <label>Satnica:</label>
            <input type="number" name="satnica" value={form.satnica} onChange={handleInputChange} required className="input-small" />
          </div>
          <div className="section-item">
            <label>Noćna od:</label>
            <input type="time" name="nocna_pocetak" value={form.nocna_pocetak} onChange={handleInputChange} />
          </div>
          <div className="section-item">
            <label>do:</label>
            <input type="time" name="nocna_kraj" value={form.nocna_kraj} onChange={handleInputChange} />
          </div>
        </div>
        
        <div className="form-section grid-4">
          <div className="section-item">
            <label>Bonus noćna (%):</label>
            <input type="number" name="nocni_bonus" value={form.nocni_bonus} onChange={handleInputChange} />
          </div>
          <div className="section-item">
            <label>Praznik (%):</label>
            <input type="number" name="praznik_bonus" value={form.praznik_bonus} onChange={handleInputChange} />
          </div>
          <div className="section-item">
            <label>Plaćen GO (%):</label>
            <input type="number" name="go_procenat" value={form.go_procenat} onChange={handleInputChange} />
          </div>
          <div className="section-item">
            <label>Bolovanje (%):</label>
            <input type="number" name="bolovanje_procenat" value={form.bolovanje_procenat} onChange={handleInputChange} />
          </div>
        </div>
        
        <div className="form-buttons">
          <button type="submit" className="btn-primary">Sačuvaj</button>
          {idZaIzmenu && (
            <button type="button" className="btn-secondary" onClick={() => { setForm(POCETNO_STANJE_FORME); setIdZaIzmenu(null); }}>
              Odustani
            </button>
          )}
        </div>
      </form>

      {ucitavam ? <p className="loading">Učitavanje podataka...</p> : (
        <div className="cards-grid">
          {zaposleni.map((radnik) => (
            <div key={radnik.id} className="worker-card">
              <h2>{radnik.ime} {radnik.prezime}</h2>
              <div className="worker-role">{radnik.pozicija}</div>
              
              <button onClick={() => { setKalendarRadnikId(radnik.id); setPrikaziKalendar(true); }} className="btn-action info">
                📅 Unesi odsustvo
              </button>
              
              <button onClick={() => generisiIzvestaj(radnik.id, `${radnik.ime} ${radnik.prezime}`, izabraniMesec, izabranaGodina)} className="btn-action dark">
                Mesečni izveštaj
              </button>
              
              <div className="attendance-buttons">
                <button onClick={() => evidencijaDolazak(radnik.id)} className="btn-attendance success">Dolazak</button>
                <button onClick={() => AnalyticsOdlazak(radnik.id)} className="btn-attendance danger">Odlazak</button>
              </div>

              <div className="card-footer-buttons">
                <button onClick={() => pripremiZaIzmenu(radnik)} className="btn-outline info">Izmeni</button>
                <button onClick={() => obrisiRadnika(radnik.id)} className="btn-outline danger">Obriši</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="table-container">
        <div className="table-header-row">
          <h2>Raspored smena (Dozvoljen unos 'GO' ili 'BOL')</h2>
          <button onClick={kopirajProsluNedelju} className="btn-copy">📋 Kopiraj raspored</button>
        </div>
        <div className="scrollable-table">
          <table>
            <thead>
              <tr>
                <th className="text-left">Zaposleni</th>
                {DANI_U_NEDELJI.map(dan => <th key={dan}>{dan}</th>)}
                <th>Ukupno sati</th>
              </tr>
            </thead>
            <tbody>
              {zaposleni.map(radnik => {
                return (
                  <tr key={`planer-${radnik.id}`}>
                    <td className="text-left font-light">{radnik.ime} {radnik.prezime}</td>
                    
                    {DANI_U_NEDELJI.map(dan => {
                      const smena = raspored.find(r => r.zaposleni_id === radnik.id && r.dan === dan) || { pocetak: '', kraj: '' };
                      const valPocetak = (smena.pocetak || '').toUpperCase();
                      const imaOdsustvo = proveriPreklapanjeOdsustva(radnik.id, dan);
                      
                      let klasaBoje = 'text-white';
                      if (valPocetak === 'GO' || imaOdsustvo === 'GO') klasaBoje = 'text-yellow';
                      if (valPocetak === 'BOL' || imaOdsustvo === 'BOLOVANJE') klasaBoje = 'text-red';
                      
                      return (
                        <td key={dan}>
                          <div className="table-inputs-group">
                            <input 
                              type="text" 
                              value={smena.pocetak || ''} 
                              onChange={(e) => sacuvajSmenu(radnik.id, dan, e.target.value, smena.kraj)} 
                              placeholder={imaOdsustvo ? imaOdsustvo : "08:00"} 
                              className={`${klasaBoje} ${imaOdsustvo ? 'input-warning' : ''}`} 
                            />
                            <input 
                              type="text" 
                              value={smena.kraj || ''} 
                              onChange={(e) => sacuvajSmenu(radnik.id, dan, smena.pocetak, e.target.value)} 
                              placeholder={imaOdsustvo ? "SLOB" : "16:00"} 
                              className={`${klasaBoje} ${imaOdsustvo ? 'input-warning' : ''}`} 
                            />
                          </div>
                        </td>
                      );
                    })}
                    <td className="font-bold">{izracunajPlaniraneSate(radnik.id)} h</td>
                  </tr>
                );
              })}
              
              <tr className="table-summary-row">
                <td className="text-left font-bold text-sky">Ukupno planirano (Firma):</td>
                {DANI_U_NEDELJI.map(dan => <td key={`prazno-${dan}`}></td>)}
                <td className="font-bold text-sky">{izracunajUkupneSateFirme()} h</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {prikaziKalendar && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Prijava odsustva</h2>
            <form onSubmit={sacuvajOdsustvo} className="modal-form">
              <div>
                <label>Tip odsustva:</label>
                <select name="tip" value={novoOdsustvo.tip} onChange={handleOdsustvoChange}>
                  <option value="GO">Godišnji odmor</option>
                  <option value="BOLOVANJE">Bolovanje</option>
                </select>
              </div>
              <div>
                <label>Od datuma:</label>
                <input type="date" name="od" required value={novoOdsustvo.od} onChange={handleOdsustvoChange} />
              </div>
              <div>
                <label>Do datuma:</label>
                <input type="date" name="do" required value={novoOdsustvo.do} onChange={handleOdsustvoChange} />
              </div>
              <div className="modal-buttons">
                <button type="submit" className="btn-action info">Sačuvaj</button>
                <button type="button" className="btn-action dark" onClick={() => setPrikaziKalendar(false)}>Zatvori</button>
              </div>
            </form>

            <div className="modal-listing">
              <h4>Trenutna odsustva radnika:</h4>
              {odsustva.filter(o => o.zaposleni_id === kalendarRadnikId).map(ods => (
                <div key={ods.id} className="listing-item">
                  <span>{ods.tip} ({new Date(ods.datum_od).toLocaleDateString('sr-RS')} - {new Date(ods.datum_do).toLocaleDateString('sr-RS')})</span>
                  <button onClick={() => obrisiOdsustvo(ods.id)} className="btn-delete-text">X</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {prikaziIzvestaj && izvestaj && (
        <div className="modal-overlay">
          <div className="modal-content scrollable-y">
            <h2>Izveštaj zarade</h2>
            <div className="modal-subtitle">{izvestaj.imeRadnika}</div>

            <div className="modal-filters">
              <select value={izabraniMesec} onChange={(e) => { setIzabraniMesec(e.target.value); generisiIzvestaj(aktivniRadnik.id, aktivniRadnik.ime, e.target.value, izabranaGodina); }}>
                <option value="1">Januar</option><option value="2">Februar</option><option value="3">Mart</option><option value="4">April</option>
                <option value="5">Maj</option><option value="6">Jun</option><option value="7">Jul</option><option value="8">Avgust</option>
                <option value="9">Septembar</option><option value="10">Oktobar</option><option value="11">Novembar</option><option value="12">Decembar</option>
              </select>
              <select value={izabranaGodina} onChange={(e) => { setIzabranaGodina(e.target.value); generisiIzvestaj(aktivniRadnik.id, aktivniRadnik.ime, izabraniMesec, e.target.value); }}>
                <option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option>
              </select>
            </div>

            <div className="report-block">
              <div className="report-row"><span className="label">Osnovna satnica:</span><span>{izvestaj.satnica} RSD</span></div>
              <div className="divider"></div>
              <div className="report-row"><span className="label">Redovni sati:</span><span>{izvestaj.ukupnoSati} h</span></div>
              <div className="report-row"><span className="label">Od toga noćni:</span><span>{izvestaj.nocniSati} h</span></div>
              <div className="report-row"><span className="label">Od toga praznični:</span><span>{izvestaj.praznicniSati} h</span></div>
              <div className="report-row highlight"><span className="font-bold">Zarada od rada:</span><span className="font-bold">{izvestaj.zaradaOdRada} RSD</span></div>
            </div>

            <div className="report-block">
              <h4>Odsustva (samo radni dani)</h4>
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

            <button onClick={() => setPrikaziIzvestaj(false)} className="btn-action dark w-100">Zatvori</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
