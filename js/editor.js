document.addEventListener('DOMContentLoaded', (event) => {
    const divEditor = document.getElementById("divEditor");
    const porukeDiv = document.getElementById("poruke");
    let editor;

    // --- NOVO: Varijable za praćenje stanja ---
    const currentUserId = 1; // Ovo bi u realnoj aplikaciji bio ID prijavljenog korisnika
    const currentScenarioId = 1; // ID scenarija koji učitavamo

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

    // --- NOVO: Dugme za SPASI (dodaj ga u HTML ako već ne postoji) ---
    // Pretpostavimo da u HTML-u imaš <button id="btnSpasi">Spasi</button>
    const btnSpasi = document.getElementById('btnSpasi');
    if(btnSpasi) {
        btnSpasi.addEventListener('click', () => {
            // Uzimamo trenutni tekst iz editora
            const noveLinije = Array.from(divEditor.querySelectorAll('p')).map(p => p.innerText);

            // 1. Pokušaj zaključati prvu liniju (za demo)
            PoziviAjax.lockLine(currentScenarioId, 1, currentUserId, (status, podaci) => {
                if (status === 200) {
                    // 2. Ako je zaključano, šalji update
                    PoziviAjax.updateLine(currentScenarioId, 1, currentUserId, noveLinije, (uStatus, uPodaci) => {
                        if (uStatus === 200) {
                            porukeDiv.innerHTML = '<p style="color: green;">Promjene su uspješno spašene na server!</p>';
                        }
                    });
                } else {
                    porukeDiv.innerHTML = `<p style="color: red;">Spašavanje nije uspjelo: ${podaci.message}</p>`;
                }
            });
        });
    }

    // --- Ostatak tvog koda (btnBold, btnItalic, itd.) ostaje ISTI ---
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
});