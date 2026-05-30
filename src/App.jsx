import { useState, useEffect } from 'react';
import './App.css';

// NOVO: Magična putanja! Na internetu će koristiti pravi link do servera, a kod kuće localhost!
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const daniUNedelji = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];

function App() {
  const [zaposleni, setZaposleni] = useState([]);
  const [raspored, setRaspored] = useState([]); 
  const [odsustva, setOdsustva] = useState([]);
  const [ucitavam, setUcitavam] = useState(true);
  
  const [novoIme, setNovoIme] = useState('');
  const [novoPrezime, setNovoPrezime] = useState('');
  const [novaPozicija, setNovaPozicija] = useState('');
  const [satnica, setSatnica] = useState('');
  const [nocnaPocetak, setNocnaPocetak] = useState('22:00');
  const [nocnaKraj, setNocnaKraj] = useState('06:00');
  const [nocniBonus, setNocniBonus] = useState('26');
  const [praznikBonus, setPraznikBonus] = useState('110');
  const [goProcenat, setGoProcenat] = useState('100');
  const [bolovanjeProcenat, setBolovanjeProcenat] = useState('65');
  const [idZaIzmenu, setIdZaIzmenu] = useState(null);

  const trenutniDatum = new Date();
  const [izabraniMesec, setIzabraniMesec] = useState(trenutniDatum.getMonth() + 1);
  const [izabranaGodina, setIzabranaGodina] = useState(trenutniDatum.getFullYear());
  const [aktivniRadnik, setAktivniRadnik] = useState(null);
  
  const [izvestaj, setIzvestaj] = useState(null);
  const [prikaziIzvestaj, setPrikaziIzvestaj] = useState(false);
  
  const [prikaziKalendar, setPrikaziKalendar] = useState(false);
  const [kalendarRadnikId, setKalendarRadnikId] = useState(null);
  const [datumOd, setDatumOd] = useState('');
  const [datumDo, setDatumDo] = useState('');
  const [tipOdsustva, setTipOdsustva] = useState('GO');

  const ucitajPodatke = () => {
    Promise.all([
      fetch(`${API_URL}/zaposleni`).then(res => res.json()),
      fetch(`${API_URL}/raspored`).then(res => res.json()),
      fetch(`${API_URL}/odsustva`).then(res => res.json())
    ]).then(([zaposleniPodaci, rasporedPodaci, odsustvaPodaci]) => {
      setZaposleni(zaposleniPodaci);
      setRaspored(rasporedPodaci);
      setOdsustva(odsustvaPodaci);
      setUcitavam(false);
    }).catch(err => console.error("Greška pri učitavanju:", err));
  };

  useEffect(() => { ucitajPodatke(); }, []);

  const sacuvajOdsustvo = (e) => {
    e.preventDefault();
    fetch(`${API_URL}/odsustva`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zaposleni_id: kalendarRadnikId, datum_od: datumOd, datum_do: datumDo, tip: tipOdsustva })
    }).then(() => {
      alert('Odsustvo sačuvano');
      ucitajPodatke();
      setPrikaziKalendar(false);
      setDatumOd(''); setDatumDo('');
    });
  };

  const obrisiOdsustvo = (id) => {
    fetch(`${API_URL}/odsustva/${id}`, { method: 'DELETE' }).then(() => ucitajPodatke());
  };

  const sacuvajSmenu = (radnikId, dan, pocetak, kraj) => {
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

  const izracunajPlaniraneSate = (radnikId) => {
    const smeneRadnika = raspored.filter(r => r.zaposleni_id === radnikId);
    let ukupnoSati = 0;
    smeneRadnika.forEach(smena => {
      if (smena.pocetak && smena.kraj && !isNaN(parseInt(smena.pocetak)) && !isNaN(parseInt(smena.kraj))) {
        let p = parseInt(smena.pocetak.split(':')[0]);
        let k = parseInt(smena.kraj.split(':')[0]);
        if (k === 0) k = 24; 
        if (k > p) ukupnoSati += (k - p);
        else if (k < p) ukupnoSati += (24 - p + k);
      }
    });
    return ukupnoSati;
  };

  const sacuvajRadnika = (e) => {
    e.preventDefault();
    const podaci = { ime: novoIme, prezime: novoPrezime, pozicija: novaPozicija, satnica, nocna_pocetak: nocnaPocetak, nocna_kraj: nocnaKraj, nocni_bonus: nocniBonus, praznik_bonus: praznikBonus, go_procenat: goProcenat, bolovanje_procenat: bolovanjeProcenat };
    const url = idZaIzmenu ? `${API_URL}/zaposleni/${idZaIzmenu}` : `${API_URL}/zaposleni`;
    fetch(url, { method: idZaIzmenu ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(podaci) })
      .then(() => { resetujFormu(); ucitajPodatke(); });
  };

  const pripremiZaIzmenu = (radnik) => {
    setNovoIme(radnik.ime); setNovoPrezime(radnik.prezime); setNovaPozicija(radnik.pozicija);
    setSatnica(radnik.satnica || ''); setNocnaPocetak(radnik.nocna_pocetak || '22:00'); setNocnaKraj(radnik.nocna_kraj || '06:00'); 
    setNocniBonus(radnik.nocni_bonus || '26'); setPraznikBonus(radnik.praznik_bonus || '110'); 
    setGoProcenat(radnik.go_procenat || '100'); setBolovanjeProcenat(radnik.bolovanje_procenat || '65');
    setIdZaIzmenu(radnik.id); 
  };

  const resetujFormu = () => {
    setNovoIme(''); setNovoPrezime(''); setNovaPozicija(''); setSatnica(''); 
    setNocnaPocetak('22:00'); setNocnaKraj('06:00'); setNocniBonus('26'); setPraznikBonus('110'); 
    setGoProcenat('100'); setBolovanjeProcenat('65'); setIdZaIzmenu(null);
  };

  const obrisiRadnika = (id) => {
    if(window.confirm("Brisanje?")) fetch(`${API_URL}/zaposleni/${id}`, { method: 'DELETE' }).then(() => ucitajPodatke());
  };

  const evidencijaDolazak = (id) => fetch(`${API_URL}/evidencija/dolazak`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zaposleni_id: id }) }).then(() => alert('Dolazak evidentiran'));
  const evidencijaOdlazak = (id) => fetch(`${API_URL}/evidencija/odlazak`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zaposleni_id: id }) }).then(() => alert('Odlazak evidentiran'));

  const generisiIzvestaj = (id, imePrezime, trazeniMesec, trazenaGodina) => {
    setAktivniRadnik({ id, ime: imePrezime });
    fetch(`${API_URL}/izvestaj/${id}?mesec=${trazeniMesec}&godina=${trazenaGodina}`)
      .then(res => res.json())
      .then(podaci => { setIzvestaj({ ...podaci, imeRadnika: imePrezime }); setPrikaziIzvestaj(true); })
      .catch(() => alert("Greška pri učitavanju izveštaja."));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1 style={{ color: '#38bdf8', fontSize: '2.5rem', marginBottom: '10px' }}>HR Menadžment</h1>
      <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '40px' }}>Evidencija i raspored rada</p>

      {/* Forma zaposleni */}
      <form onSubmit={sacuvajRadnika} style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '8px', marginBottom: '40px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '800px' }}>
        <h3 style={{ margin: 0, color: '#e2e8f0', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
          {idZaIzmenu ? 'Izmena podataka' : 'Novi zaposleni'}
        </h3>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input placeholder="Ime" value={novoIme} onChange={(e) => setNovoIme(e.target.value)} required style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white' }} />
          <input placeholder="Prezime" value={novoPrezime} onChange={(e) => setNovoPrezime(e.target.value)} required style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white' }} />
          <input placeholder="Pozicija" value={novaPozicija} onChange={(e) => setNovaPozicija(e.target.value)} required style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white' }} />
        </div>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', backgroundColor: '#0f172a', padding: '15px', borderRadius: '4px', border: '1px solid #334155' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Satnica:</label>
          <input type="number" value={satnica} onChange={(e) => setSatnica(e.target.value)} required style={{ width: '80px', padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white' }} />
          <label style={{ color: '#94a3b8', fontSize: '0.9rem', marginLeft: '10px' }}>Noćna od:</label>
          <input type="time" value={nocnaPocetak} onChange={(e) => setNocnaPocetak(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white' }} />
          <label style={{ color: '#94a3b8', fontSize: '0.9rem' }}>do:</label>
          <input type="time" value={nocnaKraj} onChange={(e) => setNocnaKraj(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white' }} />
        </div>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', backgroundColor: '#0f172a', padding: '15px', borderRadius: '4px', border: '1px solid #334155' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Bonus noćna (%):</label>
          <input type="number" value={nocniBonus} onChange={(e) => setNocniBonus(e.target.value)} style={{ width: '60px', padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white' }} />
          <label style={{ color: '#94a3b8', fontSize: '0.9rem', marginLeft: '10px' }}>Praznik (%):</label>
          <input type="number" value={praznikBonus} onChange={(e) => setPraznikBonus(e.target.value)} style={{ width: '60px', padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white' }} />
          <label style={{ color: '#94a3b8', fontSize: '0.9rem', marginLeft: '10px' }}>Plaćen GO (%):</label>
          <input type="number" value={goProcenat} onChange={(e) => setGoProcenat(e.target.value)} style={{ width: '60px', padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white' }} />
          <label style={{ color: '#94a3b8', fontSize: '0.9rem', marginLeft: '10px' }}>Bolovanje (%):</label>
          <input type="number" value={bolovanjeProcenat} onChange={(e) => setBolovanjeProcenat(e.target.value)} style={{ width: '60px', padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white' }} />
        </div>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button type="submit" style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', flex: 1 }}>Sačuvaj</button>
          {idZaIzmenu && <button type="button" onClick={resetujFormu} style={{ backgroundColor: '#64748b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}>Odustani</button>}
        </div>
      </form>

      {/* Kartice radnika */}
      {ucitavam ? (<p>Učitavanje...</p>) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', width: '100%', maxWidth: '1100px' }}>
          {zaposleni.map((radnik) => (
            <div key={radnik.id} style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', color: '#e2e8f0' }}>{radnik.ime} {radnik.prezime}</h2>
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '15px' }}>{radnik.pozicija}</div>
              
              <button onClick={() => { setKalendarRadnikId(radnik.id); setPrikaziKalendar(true); }} style={{ backgroundColor: '#0ea5e9', color: 'white', border: 'none', padding: '8px', width: '100%', borderRadius: '4px', cursor: 'pointer', marginBottom: '10px' }}>
                📅 Unesi odsustvo
              </button>
              
              <button onClick={() => generisiIzvestaj(radnik.id, `${radnik.ime} ${radnik.prezime}`, izabraniMesec, izabranaGodina)} style={{ backgroundColor: '#334155', color: 'white', border: 'none', padding: '8px', width: '100%', borderRadius: '4px', cursor: 'pointer', marginBottom: '15px' }}>
                Mesečni izveštaj
              </button>
              
              <div style={{ display: 'flex', gap: '10px', width: '100%', marginBottom: '15px' }}>
                <button onClick={() => evidencijaDolazak(radnik.id)} style={{ backgroundColor: '#059669', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', flex: 1 }}>Dolazak</button>
                <button onClick={() => evidencijaOdlazak(radnik.id)} style={{ backgroundColor: '#e11d48', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', flex: 1 }}>Odlazak</button>
              </div>

              <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: 'auto' }}>
                <button onClick={() => pripremiZaIzmenu(radnik)} style={{ backgroundColor: 'transparent', color: '#38bdf8', border: '1px solid #38bdf8', padding: '6px', borderRadius: '4px', cursor: 'pointer', flex: 1 }}>Izmeni</button>
                <button onClick={() => obrisiRadnika(radnik.id)} style={{ backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px', borderRadius: '4px', cursor: 'pointer', flex: 1 }}>Obriši</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabela rasporeda */}
      <div style={{ marginTop: '50px', width: '100%', maxWidth: '1200px', backgroundColor: '#1e293b', padding: '25px', borderRadius: '8px', border: '1px solid #334155' }}>
        <h2 style={{ color: '#e2e8f0', marginBottom: '20px', fontSize: '1.2rem', fontWeight: 'normal' }}>Raspored smena (Dozvoljen unos 'GO' ili 'BOL')</h2>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ color: '#94a3b8' }}>
                <th style={{ padding: '12px', borderBottom: '1px solid #334155', textAlign: 'left', fontWeight: 'normal' }}>Zaposleni</th>
                {daniUNedelji.map(dan => <th key={dan} style={{ padding: '12px', borderBottom: '1px solid #334155', fontWeight: 'normal' }}>{dan}</th>)}
                <th style={{ padding: '12px', borderBottom: '1px solid #334155', fontWeight: 'normal' }}>Ukupno sati</th>
              </tr>
            </thead>
            <tbody>
              {zaposleni.map(radnik => {
                return (
                  <tr key={`planer-${radnik.id}`}>
                    <td style={{ padding: '12px', borderBottom: '1px solid #334155', textAlign: 'left', color: '#e2e8f0' }}>{radnik.ime} {radnik.prezime}</td>
                    
                    {daniUNedelji.map(dan => {
                      const smena = raspored.find(r => r.zaposleni_id === radnik.id && r.dan === dan) || { pocetak: '', kraj: '' };
                      const bojaTeksta = (smena.pocetak || '').toUpperCase() === 'GO' ? '#fde047' : ((smena.pocetak || '').toUpperCase() === 'BOL' ? '#f87171' : 'white');
                      
                      return (
                        <td key={dan} style={{ padding: '8px', borderBottom: '1px solid #334155' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                            <input type="text" value={smena.pocetak || ''} onChange={(e) => sacuvajSmenu(radnik.id, dan, e.target.value, smena.kraj)} placeholder="08:00 ili GO" style={{ width: '85px', padding: '4px', borderRadius: '4px', border: '1px solid #475569', backgroundColor: '#0f172a', color: bojaTeksta, textAlign: 'center' }} />
                            <input type="text" value={smena.kraj || ''} onChange={(e) => sacuvajSmenu(radnik.id, dan, smena.pocetak, e.target.value)} placeholder="16:00 ili GO" style={{ width: '85px', padding: '4px', borderRadius: '4px', border: '1px solid #475569', backgroundColor: '#0f172a', color: bojaTeksta, textAlign: 'center' }} />
                          </div>
                        </td>
                      );
                    })}
                    
                    <td style={{ padding: '12px', borderBottom: '1px solid #334155', color: '#e2e8f0' }}>{izracunajPlaniraneSate(radnik.id)} h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Kalendar */}
      {prikaziKalendar && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1e293b', padding: '30px', borderRadius: '8px', border: '1px solid #334155', width: '90%', maxWidth: '450px' }}>
            <h2 style={{ color: '#e2e8f0', margin: '0 0 15px 0', fontSize: '1.2rem' }}>Prijava odsustva</h2>
            
            <form onSubmit={sacuvajOdsustvo} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>Tip odsustva:</label>
                <select value={tipOdsustva} onChange={(e) => setTipOdsustva(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0f172a', color: 'white', border: '1px solid #334155' }}>
                  <option value="GO">Godišnji odmor</option>
                  <option value="BOLOVANJE">Bolovanje</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>Od datuma:</label>
                <input type="date" required value={datumOd} onChange={(e) => setDatumOd(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0f172a', color: 'white', border: '1px solid #334155' }} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>Do datuma:</label>
                <input type="date" required value={datumDo} onChange={(e) => setDatumDo(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0f172a', color: 'white', border: '1px solid #334155' }} />
              </div>
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" style={{ backgroundColor: '#0ea5e9', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', flex: 1 }}>Sačuvaj</button>
                <button type="button" onClick={() => setPrikaziKalendar(false)} style={{ backgroundColor: '#475569', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', flex: 1 }}>Zatvori</button>
              </div>
            </form>

            <div style={{ marginTop: '20px', borderTop: '1px solid #334155', paddingTop: '15px' }}>
              <h4 style={{ color: '#94a3b8', margin: '0 0 10px 0' }}>Trenutna odsustva radnika:</h4>
              {odsustva.filter(o => o.zaposleni_id === kalendarRadnikId).map(ods => (
                <div key={ods.id} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: '8px', marginBottom: '5px', borderRadius: '4px', fontSize: '0.9rem', color: '#e2e8f0' }}>
                  <span>{ods.tip} ({new Date(ods.datum_od).toLocaleDateString()} - {new Date(ods.datum_do).toLocaleDateString()})</span>
                  <button onClick={() => obrisiOdsustvo(ods.id)} style={{ backgroundColor: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer' }}>X</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Izvestaj */}
      {prikaziIzvestaj && izvestaj && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1e293b', padding: '30px', borderRadius: '8px', border: '1px solid #334155', width: '90%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#e2e8f0', margin: '0 0 5px 0', fontSize: '1.5rem', fontWeight: 'normal' }}>Izveštaj zarade</h2>
            <div style={{ color: '#94a3b8', margin: '0 0 25px 0' }}>{izvestaj.imeRadnika}</div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <select value={izabraniMesec} onChange={(e) => promeniMesec(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', backgroundColor: '#0f172a', color: 'white', border: '1px solid #334155' }}>
                <option value="1">Januar</option><option value="2">Februar</option><option value="3">Mart</option><option value="4">April</option>
                <option value="5">Maj</option><option value="6">Jun</option><option value="7">Jul</option><option value="8">Avgust</option>
                <option value="9">Septembar</option><option value="10">Oktobar</option><option value="11">Novembar</option><option value="12">Decembar</option>
              </select>
              <select value={izabranaGodina} onChange={(e) => promeniGodinu(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', backgroundColor: '#0f172a', color: 'white', border: '1px solid #334155' }}>
                <option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option>
              </select>
            </div>

            <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '4px', marginBottom: '25px', fontSize: '0.95rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#94a3b8' }}>Osnovna satnica:</span><span style={{ color: 'white' }}>{izvestaj.satnica} RSD</span></div>
              <div style={{ borderBottom: '1px solid #334155', margin: '10px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#94a3b8' }}>Redovni sati:</span><span style={{ color: 'white' }}>{izvestaj.ukupnoSati} h</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#94a3b8' }}>Od toga noćni:</span><span style={{ color: 'white' }}>{izvestaj.nocniSati} h</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#94a3b8' }}>Od toga praznični:</span><span style={{ color: 'white' }}>{izvestaj.praznicniSati} h</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8', marginTop: '10px' }}><span style={{ fontWeight: 'bold' }}>Zarada od rada:</span><span style={{ fontWeight: 'bold' }}>{izvestaj.zaradaOdRada} RSD</span></div>
            </div>

            <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '4px', marginBottom: '25px', fontSize: '0.95rem' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#e2e8f0' }}>Odsustva (samo radni dani)</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#94a3b8' }}>Godišnji odmor ({izvestaj.goProcenat}%):</span><span style={{ color: '#fde047' }}>{izvestaj.satiGO} h</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#fde047' }}><span>Naknada za GO:</span><span>{izvestaj.zaradaGO} RSD</span></div>
              <div style={{ borderBottom: '1px solid #334155', margin: '10px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#94a3b8' }}>Bolovanje ({izvestaj.bolovanjeProcenat}%):</span><span style={{ color: '#f87171' }}>{izvestaj.satiBolovanje} h</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f87171' }}><span>Naknada za Bolovanje:</span><span>{izvestaj.zaradaBolovanje} RSD</span></div>
            </div>

            <div style={{ padding: '15px 0', borderTop: '1px solid #334155', borderBottom: '1px solid #334155', marginBottom: '25px' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '5px' }}>Ukupno za isplatu</div>
              <div style={{ color: 'white', fontSize: '2rem' }}>{izvestaj.plata} RSD</div>
            </div>

            <button onClick={() => setPrikaziIzvestaj(false)} style={{ backgroundColor: '#334155', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', width: '100%' }}>Zatvori</button>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;