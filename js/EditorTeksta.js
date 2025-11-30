let EditorTeksta = function (divRef) {
    // --- konstruktor i potrebne validacije ---
    if (!(divRef instanceof HTMLElement) || divRef.tagName !== 'DIV') {
        throw new Error("Pogresan tip elementa!");
    }
    if (divRef.getAttribute("contenteditable") !== "true") {
        throw new Error("Neispravan DIV, ne posjeduje contenteditable atribut!");
    }

    const editorDiv = divRef;

    // --- POMOĆNI REGEX-i---

    const WORD_SPLIT_REGEX = /[\s\.,?!:;]+/g;

    const EMPTY_LINE_REGEX = /^\s*$/;

    const SCENE_HEADING_REGEX = /^(INT\.|EXT\.)[^-\r\n]+-\s(DAY|NIGHT|AFTERNOON|MORNING|EVENING)$/i;

    const ROLE_NAME_REGEX = /^[A-Z\s]+$/;

    const PARENTHETICAL_LINE_REGEX = /^\s*\(.+\)\s*$/;

    /**
     * Parsira sav tekst iz editora u strukturirani niz linija.
     * Svaki element niza je linija, a HTML tagovi su uklonjeni.
     * @returns {string[]} Niz linija teksta
     */
    const getLines = () => {

        let content = editorDiv.innerHTML;

        content = content.replace(/<br\s*\/?>/gi, '\n');


        content = content.replace(/<\/(div|p|li)>/gi, '\n');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const textContent = tempDiv.textContent || tempDiv.innerText;


        return textContent.split('\n');
    };


    const parseScenarioStructure = () => {
        const lines = getLines();
        const structure = [];
        let currentScene = null;
        let lastRole = null;
        let currentDialogueSegment = null;
        let dialogueReplicaIndex = 0; // Broji replike unutar scene

        const finishDialogueSegment = () => {
            if (currentDialogueSegment && currentDialogueSegment.blocks.length > 0) {
                // Ako je u segmentu samo jedna uloga, to je monolog, ali se i dalje računa
                currentScene.dialogueSegments.push(currentDialogueSegment);
            }
            currentDialogueSegment = null;
        };

        const startNewDialogueSegment = () => {
            finishDialogueSegment();
            currentDialogueSegment = { blocks: [] };
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const originalLine = lines[i];

            if (EMPTY_LINE_REGEX.test(originalLine)) {
                continue;
            }

            // 1. NASLOV SCENE
            if (SCENE_HEADING_REGEX.test(line)) {
                finishDialogueSegment();
                currentScene = {
                    title: line,
                    lines: [], // Sve linije unutar scene
                    roles: new Map(), // Svi blokovi govora uloge
                    dialogueSegments: [] // Grupe blokova govora
                };
                structure.push(currentScene);
                dialogueReplicaIndex = 0;
                lastRole = null;
                continue;
            }

            // Ako još nismo u sceni, provjeri da li je linija ULOGA; ako jeste, kreiraj implicitnu scenu,
            // inače preskoči dok ne nađemo naslov scene
            if (!currentScene) {
                if (ROLE_NAME_REGEX.test(line)) {
                    // Kreiraj implicitnu scenu da bismo mogli parsirati uloge prije eksplicitnog naslova
                    currentScene = {
                        title: null,
                        lines: [],
                        roles: new Map(),
                        dialogueSegments: []
                    };
                    structure.push(currentScene);
                    dialogueReplicaIndex = 0;
                    lastRole = null;
                    // ne nastavljamo; dopusti daljnju obradu ove linije
                } else {
                    // Ako nije scena, a nije prazna linija, tretiraj kao akciju prije prve scene
                    if (!EMPTY_LINE_REGEX.test(originalLine)) {

                        lastRole = null;
                        finishDialogueSegment();
                    }
                    continue;
                }
            }

            // Dodaj liniju u trenutnu scenu
            currentScene.lines.push(originalLine);


            // 2. POTENCIJALNA ULOGA
            if (ROLE_NAME_REGEX.test(line)) {

                // Potencijalna ULOGA: (HARRY POTTER)
                const roleName = line.trim();
                const dialogueLines = []; // Samo čiste linije govora

                // Traženje prve ne-prazne linije nakon uloge
                let j = i + 1;
                let dialogueStartLine = null;
                let dialogueStartIndex = -1;

                while (j < lines.length) {
                    const currentLine = lines[j];
                    if (!EMPTY_LINE_REGEX.test(currentLine)) {
                        dialogueStartLine = currentLine.trim();
                        dialogueStartIndex = j;
                        break; // Našli smo prvu ne-praznu liniju
                    }
                    j++;
                }

                // Validacija govora
                const isValidDialogueStarter = dialogueStartLine && !SCENE_HEADING_REGEX.test(dialogueStartLine)
                    && !ROLE_NAME_REGEX.test(dialogueStartLine)

                    && !PARENTHETICAL_LINE_REGEX.test(dialogueStartLine);



                if (isValidDialogueStarter) {

                    if (!currentScene) {
                        currentScene = {
                            title: null,
                            lines: [],
                            roles: new Map(),
                            dialogueSegments: []
                        };
                        structure.push(currentScene);
                        dialogueReplicaIndex = 0;
                        lastRole = null;
                    }

                    // Provjera prekida dijalog segmenta: (Ako je nova uloga, resetiraj segment)
                    if (!currentDialogueSegment || lastRole === null || lastRole.toUpperCase() !== roleName.toUpperCase()) {
                        startNewDialogueSegment();
                    }

                    // Skupljanje bloka govora (počevši od dialogueStartIndex)
                    j = i + 1; // Resetiramo j da počnemo odmah nakon uloge (indeks i)
                    let linesInReplica = []; // Skuplja sve linije replike (prazne, napomene, govor) za currentScene.lines

                    while (j < lines.length) {
                        const currentDialogueLine = lines[j];
                        const trimmedLine = currentDialogueLine.trim();

                        // 1. Prekidanje bloka govora
                        if (SCENE_HEADING_REGEX.test(trimmedLine) || ROLE_NAME_REGEX.test(trimmedLine)) {
                            break; // Nova scena ili nova uloga prekidaju blok.
                        }

                        // Dodajemo sve linije replike u privremeni niz za scenu, 
                        // što rješava problem nedostajućih linija u currentScene.lines
                        linesInReplica.push(currentDialogueLine);

                        // 2. Prazne linije NE prekidaju blok govora, ali se NE broje u linije teksta.
                        if (EMPTY_LINE_REGEX.test(currentDialogueLine)) {
                            j++;
                            continue;
                        }

                        // 3. Scenska napomena (samo zagrade) se NE računa kao govor, ali ne prekida blok.
                        if (!PARENTHETICAL_LINE_REGEX.test(trimmedLine)) {
                            // Linije koje nisu samo scenske napomene ulaze u blok za brojanje linija/riječi.
                            dialogueLines.push(trimmedLine);
                        }

                        // Prelazak na sljedeću liniju
                        j++;
                    }

                    currentScene.lines.push(...linesInReplica);

                    // Ako je sakupljen validan blok govora
                    if (dialogueLines.length > 0) {
                        const newBlock = {
                            role: roleName,
                            replica: dialogueLines.join('\n'),
                            sceneTitle: currentScene.title,
                            replicaIndexInScene: ++dialogueReplicaIndex
                        };

                        // Punjenje strukture
                        if (!currentScene.roles.has(roleName)) {
                            currentScene.roles.set(roleName, []);
                        }
                        currentScene.roles.get(roleName).push(newBlock);

                        if (!currentDialogueSegment) {
                            startNewDialogueSegment();
                        }
                        currentDialogueSegment.blocks.push(newBlock);

                        lastRole = roleName;
                        i = j - 1; // Postavljamo i na liniju prije kraja bloka, jer će i++ preći na sljedeću liniju.
                        continue;
                    }
                }
            }


            if (!PARENTHETICAL_LINE_REGEX.test(line)) {
                // Ako nije uloga, nije scena, nije prazna linija i nije samo u zagradama -> to je AKCIJSKI SEGMENT
                lastRole = null;
                finishDialogueSegment(); // Akcija prekida dijalog segment
            }
            // Linija u zagradama NE prekida dijalog segment i NE resetira lastRole
        }

        finishDialogueSegment(); // Završi posljednji segment
        return structure;
    };


    // --- POMOĆNE FUNKCIJE ZA formatirajTekst ---

    const isSelectionInEditor = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        return editorDiv.contains(range.startContainer) && editorDiv.contains(range.endContainer);
    };

    /**
     * Pomoćna funkcija za izračunavanje Levenshteinove udaljenosti.
     * @param {string} a 
     * @param {string} b
     * @returns {number} 
     */
    const levenshteinDistance = (a, b) => {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];

        // Inicijalizacija prve kolone
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        // Inicijalizacija prvog reda
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        // Popunjavanje matrice
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = a[j - 1] === b[i - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1, // Umetanje
                    matrix[i][j - 1] + 1, // Brisanje
                    matrix[i - 1][j - 1] + cost // Zamjena
                );
            }
        }

        return matrix[b.length][a.length];
    };

    // --- IMPLEMENTACIJA METODA MODULA ---

    // NOVA I POBOLJŠANA IMPLEMENTACIJA METODE dajBrojRijeci
    let dajBrojRijeci = function () {
        let ukupno = 0;
        let boldiranih = 0;
        let italic = 0;

        // Regex za pronalaženje VALIDNE RIJEČI (koja nije čisti broj ili samostalni znak)
        // \b označava granicu riječi.
        // [\w'-]+ - hvata niz alfanumeričkih znakova, apostrofa ili crtica.
        const VALID_WORD_REGEX = /\b([\w'-]+)\b/g;

        const treeWalker = document.createTreeWalker(
            editorDiv,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // Izbjegavanje skrivenih elemenata i onih unutar skripte/stila
                    if (node.parentElement && (node.parentElement.style.display === 'none' || node.parentElement.nodeName === 'STYLE' || node.parentElement.nodeName === 'SCRIPT')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            },
            false
        );

        let node;
        while (node = treeWalker.nextNode()) {
            const textContent = node.nodeValue;
            if (!textContent) continue;

            // KORISTI match() da pronađe samo ono što izgleda kao riječ
            const words = textContent.match(VALID_WORD_REGEX);

            if (!words) continue;

            // Pronađi elemente formata iznad ovog tekstualnog čvora PRIJE petlje riječi
            let parent = node.parentElement;
            let isBold = false;
            let isItalic = false;

            while (parent && parent !== editorDiv) {
                if (parent.nodeName === 'B' || parent.nodeName === 'STRONG') isBold = true;
                if (parent.nodeName === 'I' || parent.nodeName === 'EM') isItalic = true;
                if (isBold && isItalic) break;
                parent = parent.parentElement;
            }

            for (let word of words) {
                // Pravilo 1: Isključi oznake HTML elemenata
                if (/^<.+>$/.test(word.trim())) continue;

                // Pravilo 2: Isključi čiste brojeve (može biti i decimalni)
                // Ako riječ sadrži samo brojeve, zanemari je.
                if (/^\d+(\.\d+)?$/.test(word)) {
                    continue;
                }

                // Pravilo 3: Isključi samostalne interpunkcijske znakove (koje bi regex mogao promašiti, npr. '&')
                if (word.length === 1 && /[^a-zA-Z0-9'-]/.test(word)) {
                    continue;
                }

                // Ako je došla dovde, riječ je validna.
                ukupno++;

                if (isBold) boldiranih++;
                if (isItalic) italic++;
            }
        }

        return {
            ukupno: ukupno,
            boldiranih: boldiranih,
            italic: italic
        };
    };

    let dajUloge = function () {
        const structure = parseScenarioStructure();
        const uniqueRoles = new Set();
        const rolesInOrder = [];

        // Prođi kroz sve scene i sve blokove govora
        for (const scene of structure) {
            // Skupi sve uloge iz svih dijalog segmenata unutar scene
            for (const segment of scene.dialogueSegments) {
                for (const block of segment.blocks) {
                    const roleName = block.role;
                    if (!uniqueRoles.has(roleName)) {
                        uniqueRoles.add(roleName);
                        rolesInOrder.push(roleName);
                    }
                }
            }
        }

        return rolesInOrder;
    };

    let pogresnaUloga = function () {
        const structure = parseScenarioStructure();
        const roleCounts = new Map();
        const roleNames = [];

        // 1. Prikupljanje svih jedinstvenih uloga i broja pojavljivanja
        for (const scene of structure) {
            for (const segment of scene.dialogueSegments) {
                for (const block of segment.blocks) {
                    const roleName = block.role;
                    roleCounts.set(roleName, (roleCounts.get(roleName) || 0) + 1);
                    if (!roleNames.includes(roleName)) {
                        roleNames.push(roleName);
                    }
                }
            }
        }

        const potentiallyWrongRoles = new Set();

        // 2. Poređenje svake uloge (A) sa svakom drugom (B)
        for (let i = 0; i < roleNames.length; i++) {
            const roleA = roleNames[i];
            const countA = roleCounts.get(roleA);

            for (let j = 0; j < roleNames.length; j++) {
                if (i === j) continue;

                const roleB = roleNames[j];
                const countB = roleCounts.get(roleB);

                const lengthA = roleA.replace(/\s/g, '').length;
                const lengthB = roleB.replace(/\s/g, '').length;
                const dist = levenshteinDistance(roleA.replace(/\s/g, ''), roleB.replace(/\s/g, ''));

                // Odredi maksimalnu dozvoljenu udaljenost

                let maxDist;
                const lenA = roleA.replace(/\s/g, '').length; // Ponovo koristimo lengthA
                if (lenA > 5) {
                    maxDist = 2;
                } else {
                    maxDist = 1;
                }

                // Uslov 1: Vrlo su slične
                const isVerySimilar = dist <= maxDist;

                // Uslov 2: B se pojavljuje znatno češće od A
                const isBMoreFrequent = countB >= 4 && (countB - countA) >= 3;

                // Ako je A potencijalno pogrešna uloga, a B je ispravna verzija
                if (isVerySimilar && isBMoreFrequent) {
                    potentiallyWrongRoles.add(roleA);
                    // Prekidamo unutrašnju petlju jer je A već detektovana kao pogrešna
                    break;
                }
            }
        }

        return Array.from(potentiallyWrongRoles);
    };

    let brojLinijaTeksta = function (uloga) {
        const targetRole = uloga.toUpperCase();
        const structure = parseScenarioStructure();
        let totalLines = 0;

        for (const scene of structure) {
            // Provjeri sve prikupljene blokove govora u toj sceni
            for (const roleBlocks of scene.roles.values()) {
                for (const block of roleBlocks) {
                    if (block.role.toUpperCase() === targetRole) {
                        // Broj linija teksta je broj linija u replici.
                        totalLines += block.replica.split('\n').length;
                    }
                }
            }
        }

        return totalLines;
    };

    let scenarijUloge = function (uloga) {
        const targetRoleUpper = uloga.toUpperCase();
        const structure = parseScenarioStructure();
        const results = [];

        // 1. Kreiraj globalni niz svih blokova govora, uz zadržavanje scene i indeksa
        const allBlocks = [];
        for (const scene of structure) {
            for (const segment of scene.dialogueSegments) {
                for (const block of segment.blocks) {
                    allBlocks.push(block);
                }
            }
        }

        // 2. Prođi kroz globalni niz i formiraj strukturu
        for (let i = 0; i < allBlocks.length; i++) {
            const currentBlock = allBlocks[i];

            if (currentBlock.role.toUpperCase() === targetRoleUpper) {
                const prevBlock = allBlocks[i - 1];
                const nextBlock = allBlocks[i + 1];

                let previous = null;
                let next = null;

                // Prethodna replika (samo ako postoji i ako je dio ISTOG DIJALOG SEGMENTA, tj. nije prekinuta akcijom/scenom)
                // U našoj strukturi, svi blokovi su već poredani unutar scene/segmenta,
                // ali moramo provjeriti da li su u istom dialogueSegmentu (da nije uloga=A, akcija, uloga=A)

                // Pojednostavljeni pristup: Koristimo samo allBlocks (jer su blokovi u segmentu već uzastopni)
                if (prevBlock && prevBlock.sceneTitle === currentBlock.sceneTitle) {
                    // Provjera prekida segmenta nije striktno potrebna ovdje ako je parser ispravno radio
                    previous = {
                        uloga: prevBlock.role,
                        linije: prevBlock.replica
                    };
                }

                // Sljedeća replika (samo ako postoji i u istom je segmentu)
                if (nextBlock && nextBlock.sceneTitle === currentBlock.sceneTitle) {
                    next = {
                        uloga: nextBlock.role,
                        linije: nextBlock.replica
                    };
                }

                results.push({
                    scena: currentBlock.sceneTitle,
                    pozicijaUTekstu: currentBlock.replicaIndexInScene,
                    prethodni: previous,
                    trenutni: {
                        uloga: currentBlock.role,
                        linije: currentBlock.replica
                    },
                    sljedeci: next
                });
            }
        }

        return results;
    };

    let grupisiUloge = function () {
        const structure = parseScenarioStructure();
        const groups = [];

        for (const scene of structure) {
            let segmentIndex = 0;
            for (const segment of scene.dialogueSegments) {
                if (segment.blocks.length > 0) {
                    segmentIndex++;

                    const rolesInSegment = new Map();
                    const rolesOrder = [];

                    for (const block of segment.blocks) {
                        const roleName = block.role;
                        if (!rolesInSegment.has(roleName)) {
                            rolesInSegment.set(roleName, true);
                            rolesOrder.push(roleName);
                        }
                    }

                    groups.push({
                        scena: scene.title,
                        segment: segmentIndex,
                        uloge: rolesOrder
                    });
                }
            }
        }

        return groups;
    };

    let formatirajTekst = function (komanda) {
        if (!isSelectionInEditor()) {
            return false;
        }

        const allowedCommands = ["bold", "italic", "underline"];
        if (!allowedCommands.includes(komanda)) {
            console.error("Nepoznata komanda za formatiranje:", komanda);
            return false;
        }

        const selection = window.getSelection();
        if (selection.isCollapsed) {
            return false; // Ništa nije označeno
        }

        // Korištenje document.execCommand
        try {
            // execCommand rukuje neugniježđivanjem za bold i italic, 
            // a za underline koristi <U> tag (ili span/style, ovisno o browseru).
            document.execCommand(komanda, false, null);
            return true;
        } catch (e) {
            console.error("Greška pri formatiranju:", e);
            return false;
        }
    };

    // --- JAVNI INTERFEJS MODULA ---
    return {
        dajBrojRijeci: dajBrojRijeci,
        dajUloge: dajUloge,
        pogresnaUloga: pogresnaUloga,
        brojLinijaTeksta: brojLinijaTeksta,
        scenarijUloge: scenarijUloge,
        grupisiUloge: grupisiUloge,
        formatirajTekst: formatirajTekst
    };
};