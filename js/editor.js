document.addEventListener('DOMContentLoaded', (event) => {
    const divEditor = document.getElementById("divEditor");
    const porukeDiv = document.getElementById("poruke");
    let editor;


    // --- NOVO: Varijable za praćenje stanja ---
    const currentUserId = Math.floor(Math.random() * 10000) + 1;
    const currentScenarioId = 1; // ID scenarija koji učitavamo
    // Varijabla za praćenje trenutno zaključane linije na frontendu
let trenutnoZakljucanaLinijaId = null;

divEditor.addEventListener('click', (e) => {
    const p = e.target.closest('p');
    if (!p) return;

    const lineId = p.getAttribute('data-line-id');

    // Pozivamo lockLine rute
    PoziviAjax.lockLine(currentScenarioId, lineId, currentUserId, (status, podaci) => {
        if (status === 200) {
            // Skinemo editabilnost sa svih, pa stavimo samo na ovaj
            divEditor.querySelectorAll('p').forEach(el => el.contentEditable = false);
            p.contentEditable = true;
            p.focus();
            trenutnoZakljucanaLinijaId = lineId;
            porukeDiv.innerHTML = `<p style="color: blue;">Linija ${lineId} zaključana i spremna za uređivanje.</p>`;
        } else {
            porukeDiv.innerHTML = `<p style="color: red;">${podaci.message}</p>`;
        }
    });
});

    // --- IZMJENA: Inicijalizacija editora ide unutar funkcije za učitavanje ---
    function inicijalizirajSistem() {
        // Prvo pozivamo server da nam da podatke
        PoziviAjax.getScenario(currentScenarioId, (status, scenario) => {
            if (status === 200) {
                // 1. Stavimo tekst iz baze/fajla u div
                // Pretpostavljamo da scenario ima niz 'content' (tako smo napravili u index.js)
                divEditor.innerHTML = scenario.content.map(line => `<p data-line-id="${line.lineId}">${line.text}</p>`).join("");
                
                // 2. Tek kad je tekst u divu, inicijaliziramo tvoju logiku EditorTeksta
                try {
                    editor = EditorTeksta(divEditor);
                    porukeDiv.innerHTML = 'Scenario učitan sa servera i editor spreman.';
                } catch (error) {
                    porukeDiv.innerHTML = `<h2 style="color: red;">Greška pri inicijalizaciji:</h2> <p>${error.message}</p>`;
                }
            } else {
                porukeDiv.innerHTML = '<h2 style="color: red;">Greška:</h2><p>Ne mogu učitati scenario sa servera.</p>';
            }
        });
    }

    // Pokreni sve
    inicijalizirajSistem();

const btnSpasi = document.getElementById('btnSpasi'); 
    if (btnSpasi) {
        btnSpasi.addEventListener('click', () => {
            if (!trenutnoZakljucanaLinijaId) {
                porukeDiv.innerHTML = '<p style="color: orange;">Prvo kliknite na liniju koju želite urediti!</p>';
                return;
            }

            const pElement = divEditor.querySelector(`p[data-line-id="${trenutnoZakljucanaLinijaId}"]`);
            if (!pElement) return;

            // Uzimamo tekst iz paragrafa
            const tekstZaSlanje = [pElement.innerText]; 

            // Pozivamo AJAX za spašavanje
            PoziviAjax.updateLine(currentScenarioId, trenutnoZakljucanaLinijaId, currentUserId, tekstZaSlanje, (status, podaci) => {
                if (status === 200) {
                    // 1. Odmah dajemo vizuelnu povratnu informaciju
                    porukeDiv.innerHTML = '<p style="color: green; font-weight: bold;">Promjene su trajno spremljene na server!</p>';
                    
                    // 2. "Zaključavamo" paragraf vizuelno odmah da korisnik vidi da je gotovo
                    pElement.contentEditable = false;
                    pElement.style.backgroundColor = "transparent"; 
                    
                    // Spremimo ID u privremenu varijablu pa resetujemo globalnu
                    const staraId = trenutnoZakljucanaLinijaId;
                    trenutnoZakljucanaLinijaId = null;

                    // 3. ČEKAMO 1 sekundu prije osvježavanja
                    // Ovo omogućava serveru da završi fs.writeFile, a korisniku da vidi poruku uspjeha
                    setTimeout(() => {
                        inicijalizirajSistem(); 
                    }, 1000); 

                } else {
                    porukeDiv.innerHTML = `<p style="color: red;">Greška: ${podaci.message || 'Neuspješno spašavanje'}</p>`;
                }
            });
        });
    }
 
    const prikaziRezultat = (naslov, rezultat) => {
        const output = Array.isArray(rezultat) || typeof rezultat === 'object' && rezultat !== null
            ? JSON.stringify(rezultat, null, 2)
            : String(rezultat);
            
        porukeDiv.innerHTML = `
            <h2>${naslov}</h2>
            <pre>${output}</pre>
        `;
    };

    document.getElementById('btnBold').addEventListener('click', () => {
        const success = editor.formatirajTekst('bold');
        porukeDiv.innerHTML = success 
            ? '<h2>Formatiranje:</h2><p style="color: green;">Primijenjeno **Bold** formatiranje.</p>' 
            : '<h2>Formatiranje:</h2><p style="color: orange;">Nije bilo selekcije ili selekcija nije unutar editora.</p>';
    });

    document.getElementById('btnItalic').addEventListener('click', () => {
        const success = editor.formatirajTekst('italic');
        porukeDiv.innerHTML = success 
            ? '<h2>Formatiranje:</h2><p style="color: green;">Primijenjeno *Italic* formatiranje.</p>' 
            : '<h2>Formatiranje:</h2><p style="color: orange;">Nije bilo selekcije ili selekcija nije unutar editora.</p>';
    });

    document.getElementById('btnUnderline').addEventListener('click', () => {
        const success = editor.formatirajTekst('underline');
        porukeDiv.innerHTML = success 
            ? '<h2>Formatiranje:</h2><p style="color: green;">Primijenjeno <u>Underline</u> formatiranje.</p>' 
            : '<h2>Formatiranje:</h2><p style="color: orange;">Nije bilo selekcije ili selekcija nije unutar editora.</p>';
    });
    

    document.getElementById('btnBrojRijeci').addEventListener('click', () => {
        const rezultat = editor.dajBrojRijeci();
        prikaziRezultat("Rezultat metode: dajBrojRijeci()", rezultat);
    });

    document.getElementById('btnDajUloge').addEventListener('click', () => {
        const rezultat = editor.dajUloge();
        prikaziRezultat("Rezultat metode: dajUloge() (Jedinstvene uloge)", rezultat);
    });
    
    document.getElementById('btnPogresnaUloga').addEventListener('click', () => {
        const rezultat = editor.pogresnaUloga();
        prikaziRezultat("Rezultat metode: pogresnaUloga()", rezultat);
    });

    document.getElementById('btnBrojLinijaTeksta').addEventListener('click', () => {
        const uloga = prompt("Unesite IME ULOGE za brojanje linija (npr. HAGRID):");
        if (uloga) {
            const rezultat = editor.brojLinijaTeksta(uloga);
            prikaziRezultat(`Rezultat metode: brojLinijaTeksta("${uloga}")`, rezultat);
        } else {
            porukeDiv.textContent = 'Unos uloge je otkazan.';
        }
    });

    document.getElementById('btnScenarijUloge').addEventListener('click', () => {
        const uloga = prompt("Unesite IME ULOGE za scenarij (npr. DUMBLEDORE):");
        if (uloga) {
            const rezultat = editor.scenarijUloge(uloga);
            prikaziRezultat(`Rezultat metode: scenarijUloge("${uloga}")`, rezultat);
        } else {
            porukeDiv.textContent = 'Unos uloge je otkazan.';
        }
    });
    
    document.getElementById('btnGrupisiUloge').addEventListener('click', () => {
        const rezultat = editor.grupisiUloge();
        prikaziRezultat("Rezultat metode: grupisiUloge()", rezultat);
    });
    // --- NOVO: Dugme za promjenu imena lika (Spirala 3) ---
    const btnPromijeniLika = document.getElementById('btnPromijeniLika');
    if (btnPromijeniLika) {
        btnPromijeniLika.addEventListener('click', () => {
            const stariLik = prompt("Unesite IME LIKA koje želite promijeniti (npr. HAGRID):");
            if (!stariLik) return;
            
            const noviLik = prompt(`Unesite NOVO IME za lika "${stariLik}":`);
            if (!noviLik) return;

            // 1. Korak: Zaključaj ime lika na serveru
            PoziviAjax.lockCharacter(currentScenarioId, stariLik, currentUserId, (status, podaci) => {
                if (status === 200) {
                    // 2. Korak: Ako je zaključavanje uspjelo, pošalji zahtjev za promjenu
                    PoziviAjax.updateCharacter(currentScenarioId, currentUserId, stariLik, noviLik, (uStatus, uPodaci) => {
                        if (uStatus === 200) {
                            porukeDiv.innerHTML = `<p style="color: green;">Lik "${stariLik}" je uspješno promijenjen u "${noviLik}" u cijelom scenariju!</p>`;
                            // Osvježi editor da se vide nova imena
                            inicijalizirajSistem(); 
                        } else {
                            porukeDiv.innerHTML = `<p style="color: red;">Greška pri ažuriranju: ${uPodaci.message}</p>`;
                        }
                    });
                } else {
                    // Ako je neko drugi već zaključao tog lika (Conflict 409)
                    porukeDiv.innerHTML = `<p style="color: red;">Greška: ${podaci.message}</p>`;
                }
            });
        });
    }
});