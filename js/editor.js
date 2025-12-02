
document.addEventListener('DOMContentLoaded', (event) => {
  
    const divEditor = document.getElementById("divEditor");
    const porukeDiv = document.getElementById("poruke");
    let editor;

  
    try {
        editor = EditorTeksta(divEditor);
        porukeDiv.innerHTML = 'Editor uspješno inicijaliziran. Spreman za unos i analizu scenarija.';
    } catch (error) {
        porukeDiv.innerHTML = `<h2 style="color: red;">Greška pri inicijalizaciji:</h2> <p>${error.message}</p>`;
        return; 
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
});