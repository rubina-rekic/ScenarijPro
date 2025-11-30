let EditorTeksta = function (divRef) {
    // --- VALIDACIJA KONSTRUKTORA ---
    if (!(divRef instanceof HTMLElement) || divRef.tagName !== 'DIV') {
        throw new Error("Pogresan tip elementa!");
    }
    if (divRef.getAttribute("contenteditable") !== "true") {
        throw new Error("Neispravan DIV, ne posjeduje contenteditable atribut!");
    }

    const editorDiv = divRef;


    const WORD_SPLIT_REGEX = /[\s\.,]+/g;


    const VALID_WORD_CHECK = /[a-zA-ZčćžšđČĆŽŠĐ]+/;

    const EMPTY_LINE_REGEX = /^\s*$/;
    const SCENE_HEADING_REGEX = /^(INT\.|EXT\.)[\w\W]*\s-\s(DAY|NIGHT|AFTERNOON|MORNING|EVENING)\s*$/;

    const ROLE_NAME_REGEX = /^(?=.*[A-ZČĆŽŠĐ])[A-ZČĆŽŠĐ\s]+$/;
    const PARENTHETICAL_LINE_REGEX = /^\s*\(.+\)\s*$/;

    const parseScenarioStructure = () => {

        let text = editorDiv.innerText;

        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = text.split('\n');

        const structure = [];
        let currentScene = {
            title: null, // Implicitna scena ako nema naslova
            roles: new Map(), // Map<ImeUloge, Array<Block>>
            dialogueSegments: [] // Array<{id, blocks:[]}>
        };
        structure.push(currentScene);

        let currentDialogueSegment = null;
        let segmentCounter = 0;
        let replicaIndexInScene = 0;

        // Pomoćna funkcija za zatvaranje segmenta
        const finishDialogueSegment = () => {
            if (currentDialogueSegment) {
                if (currentDialogueSegment.blocks.length > 0) {
                    currentScene.dialogueSegments.push(currentDialogueSegment);
                }
                currentDialogueSegment = null;
            }
        };

        const startNewDialogueSegment = () => {
            finishDialogueSegment();
            segmentCounter++;
            currentDialogueSegment = {
                id: segmentCounter,
                blocks: []
            };
        };

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            // Preskoči prazne linije
            if (EMPTY_LINE_REGEX.test(line)) continue;

            // 1. SCENA (Ovo ti je bilo dobro, ali dodajemo closeSegment)
            if (SCENE_HEADING_REGEX.test(line)) {
                finishDialogueSegment(); // Bitno: scena prekida dijalog
                currentScene = {
                    title: line,
                    roles: new Map(),
                    dialogueSegments: []
                };
                structure.push(currentScene);
                replicaIndexInScene = 0;
                segmentCounter = 0;
                continue;
            }


            if (ROLE_NAME_REGEX.test(line)) {

                if (i + 1 < lines.length) {
                    let nextLineRaw = lines[i + 1];

                    if (EMPTY_LINE_REGEX.test(nextLineRaw)) {
                        finishDialogueSegment(); // Ovo je onda akcija, prekida dijalog
                        continue;
                    }


                    let nextTrim = nextLineRaw.trim();
                    if (SCENE_HEADING_REGEX.test(nextTrim) || ROLE_NAME_REGEX.test(nextTrim)) {
                        finishDialogueSegment();
                        continue;
                    }

                    // Ako smo prošli provjere, skupljamo govor
                    let bufferLines = [];
                    let j = i + 1;
                    while (j < lines.length) {
                        let ln = lines[j].trim();
                        // Prekidi bloka govora:
                        if (EMPTY_LINE_REGEX.test(ln)) break; // Prazna linija prekida blok
                        if (SCENE_HEADING_REGEX.test(ln)) break;
                        if (ROLE_NAME_REGEX.test(ln)) break;

                        bufferLines.push(ln);
                        j++;
                    }

                    // Provjera ima li govora koji nije u zagradi
                    const cleanReplicaLines = bufferLines.filter(l => !PARENTHETICAL_LINE_REGEX.test(l));

                    if (cleanReplicaLines.length > 0) {
                        // USPJEŠNA ULOGA
                        const roleName = line;
                        if (!currentDialogueSegment) startNewDialogueSegment();

                        replicaIndexInScene++;
                        const block = {
                            role: roleName,
                            replica: cleanReplicaLines.join('\n'),
                            sceneTitle: currentScene.title,
                            replicaIndex: replicaIndexInScene,
                            segmentId: currentDialogueSegment.id
                        };

                        currentDialogueSegment.blocks.push(block);
                        if (!currentScene.roles.has(roleName)) currentScene.roles.set(roleName, []);
                        currentScene.roles.get(roleName).push(block);

                        i = j - 1;
                        continue;
                    }
                }
            }


            if (!PARENTHETICAL_LINE_REGEX.test(line)) {
                finishDialogueSegment();
            }
        }
        finishDialogueSegment(); // Zatvori zadnji
        return structure;
    };

    // --- METODE ---
    let dajBrojRijeci = function () {
    const text = editorDiv.innerText || "";
    const allWords = text.split(WORD_SPLIT_REGEX);
    // 1. Ukupan broj riječi (ovo ti je već bilo dobro)
    const ukupno = allWords.filter(w => VALID_WORD_CHECK.test(w) && !/^\d+$/.test(w)).length;

    let boldiranih = 0;
    let italic = 0;

    const walker = document.createTreeWalker(editorDiv, NodeFilter.SHOW_TEXT, null, false);
    let node;

    while (node = walker.nextNode()) {
        const nodeText = node.nodeValue;
        if (!nodeText.trim()) continue; // Preskoči prazne

        // Provjera stila roditelja
        let parent = node.parentElement;
        let isBold = false;
        let isItalic = false;

        while (parent && parent !== editorDiv) {
            const style = window.getComputedStyle(parent);
            const fw = style.fontWeight;
            const fs = style.fontStyle;
            if (fw === 'bold' || fw === 'bolder' || parseInt(fw) >= 700) isBold = true;
            if (fs === 'italic') isItalic = true;
            parent = parent.parentElement;
        }

        if (!isBold && !isItalic) continue;

        
        let isStartBroken = false;
        let isEndBroken = false;

        if (VALID_WORD_CHECK.test(nodeText.charAt(0))) {
             let prev = node.previousSibling;
             while(prev && prev.nodeType !== 3) prev = prev.previousSibling; // Nađi prethodni text node
             if (prev && VALID_WORD_CHECK.test(prev.nodeValue.slice(-1))) {
                 isStartBroken = true;
             }
        }

        if (VALID_WORD_CHECK.test(nodeText.slice(-1))) {
             let next = node.nextSibling;
             while(next && next.nodeType !== 3) next = next.nextSibling; // Nađi sljedeći text node
             if (next && VALID_WORD_CHECK.test(next.nodeValue.charAt(0))) {
                 isEndBroken = true;
             }
        }

        const wordsInNode = nodeText.split(WORD_SPLIT_REGEX);
        
        for (let k = 0; k < wordsInNode.length; k++) {
            let w = wordsInNode[k];
            if (VALID_WORD_CHECK.test(w) && !/^\d+$/.test(w)) {
                if (k === 0 && isStartBroken) continue;
                
                if (k === wordsInNode.length - 1 && isEndBroken) continue;

                if (isBold) boldiranih++;
                if (isItalic) italic++;
            }
        }
    }

    // Sigurnosna provjera (zbir ne smije preći ukupno)
    if (boldiranih > ukupno) boldiranih = ukupno;
    if (italic > ukupno) italic = ukupno;

    return { ukupno, boldiranih, italic };
};

    let dajUloge = function () {
        const structure = parseScenarioStructure();
        const roles = new Set();

        structure.forEach(scene => {

            scene.dialogueSegments.forEach(segment => {
                segment.blocks.forEach(block => {
                    roles.add(block.role);
                });
            });
        });

        return Array.from(roles);
    };

    let pogresnaUloga = function () {
        const structure = parseScenarioStructure();
        const roleCounts = {};

        // 1. Prebroj pojavljivanja
        structure.forEach(scene => {
            scene.dialogueSegments.forEach(segment => {
                segment.blocks.forEach(block => {
                    const r = block.role;
                    roleCounts[r] = (roleCounts[r] || 0) + 1;
                });
            });
        });

        const roles = Object.keys(roleCounts);
        const suspects = new Set();

        // Levenshteinova distanca funkcija
        const levenshtein = (a, b) => {
            const matrix = [];
            for (let i = 0; i <= b.length; i++) matrix[i] = [i];
            for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
            for (let i = 1; i <= b.length; i++) {
                for (let j = 1; j <= a.length; j++) {
                    if (b.charAt(i - 1) == a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
                    else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
                }
            }
            return matrix[b.length][a.length];
        };


        for (let i = 0; i < roles.length; i++) {
            const A = roles[i];
            for (let j = 0; j < roles.length; j++) {
                if (i === j) continue;
                const B = roles[j];


                const dist = levenshtein(A, B);
                const maxDist = (A.length > 5 && B.length > 5) ? 2 : 1;

                if (dist <= maxDist) {
                    const countA = roleCounts[A];
                    const countB = roleCounts[B];

                    if (countB >= 4 && (countB - countA) >= 3) {
                        suspects.add(A);
                    }
                }
            }
        }
        return Array.from(suspects);
    };

    let brojLinijaTeksta = function (uloga) {
        const structure = parseScenarioStructure();
        let count = 0;
        structure.forEach(scene => {
            if (scene.roles.has(uloga)) {
                scene.roles.get(uloga).forEach(block => {
                    if (block.replica.length > 0)
                        count += block.replica.split('\n').length;
                });
            }
        });
        return count;
    };

    let scenarijUloge = function (uloga) {
    const structure = parseScenarioStructure();
    const result = [];
    const targetRole = uloga.toUpperCase(); // Case-insensitive poređenje

    // 1. Skupi sve blokove u jedan ravni niz
    let allBlocks = [];
    structure.forEach(scene => {
        scene.dialogueSegments.forEach(segment => {
            segment.blocks.forEach(block => {
                allBlocks.push({
                    ...block,
                    sceneObj: scene
                });
            });
        });
    });

    // 2. SPOJI UZASTOPNE REPLIKE ISTE ULOGE
    // (Ovo je dio koji ti je nedostajao)
    let mergedBlocks = [];
    if (allBlocks.length > 0) {
        let currentMerge = allBlocks[0];
        for (let i = 1; i < allBlocks.length; i++) {
            let next = allBlocks[i];
            
            // Uslovi za spajanje: Ista uloga, ista scena, isti segment dijaloga
            if (next.role === currentMerge.role && 
                next.sceneTitle === currentMerge.sceneTitle &&
                next.segmentId === currentMerge.segmentId) {
                
                // Spoji tekst replike novim redom
                currentMerge.replica += "\n" + next.replica;
            } else {
                // Gurni stari i postavi novi za praćenje
                mergedBlocks.push(currentMerge);
                currentMerge = next;
            }
        }
        mergedBlocks.push(currentMerge); // Gurni zadnji
    } else {
        mergedBlocks = allBlocks;
    }

    // 3. Kreiraj traženi format iz MERGED niza
    for (let i = 0; i < mergedBlocks.length; i++) {
        const curr = mergedBlocks[i];

        // Provjera da li je to tražena uloga
        if (curr.role.toUpperCase() === targetRole) {

            let prevObj = null;
            let nextObj = null;

            // PRETHODNI (Gledamo unutar mergedBlocks)
            if (i > 0) {
                const prev = mergedBlocks[i - 1];
                // Mora biti ista scena i isti segment da bi bio dio dijaloga
                if (prev.sceneTitle === curr.sceneTitle && prev.segmentId === curr.segmentId) {
                    prevObj = {
                        uloga: prev.role,
                        linije: prev.replica
                    };
                }
            }

            // SLJEDEĆI
            if (i < mergedBlocks.length - 1) {
                const next = mergedBlocks[i + 1];
                if (next.sceneTitle === curr.sceneTitle && next.segmentId === curr.segmentId) {
                    nextObj = {
                        uloga: next.role,
                        linije: next.replica
                    };
                }
            }

            result.push({
                scena: curr.sceneTitle || "SCENE 1", // Fallback ako nema naslova
                pozicijaUTekstu: curr.replicaIndex, // Ostavljamo originalni indeks prvog bloka
                prethodni: prevObj,
                trenutni: {
                    uloga: curr.role,
                    linije: curr.replica
                },
                sljedeci: nextObj
            });
        }
    }
    return result;
};

    let grupisiUloge = function () {
        const structure = parseScenarioStructure();
        const result = [];

        structure.forEach(scene => {

            scene.dialogueSegments.forEach((segment, index) => {
                const uniqueRolesInSegment = new Set();
                const sortedRoles = [];

                segment.blocks.forEach(block => {
                    if (!uniqueRolesInSegment.has(block.role)) {
                        uniqueRolesInSegment.add(block.role);
                        sortedRoles.push(block.role);
                    }
                });

                if (sortedRoles.length > 0) {
                    result.push({
                        scena: scene.title,
                        segment: index + 1, // Indeksacija od 1
                        uloge: sortedRoles
                    });
                }
            });
        });

        return result;
    };

   let formatirajTekst = function (komanda) {
        const selection = window.getSelection();

        
        if (!selection || selection.rangeCount === 0) {
            return false;
        }

       
        if (selection.isCollapsed) {
            return false;
        }

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;

        
        let node = container;
        let inside = false;

        
        if (node.nodeType === 3) { 
            node = node.parentNode;
        }

        while (node) {
            if (node === editorDiv) {
                inside = true;
                break;
            }
            node = node.parentNode;
        }

        
        if (!inside) {
            return false;
        }

      
        let execCmd = null;
        if (komanda === 'bold') execCmd = 'bold';
        if (komanda === 'italic') execCmd = 'italic';
        if (komanda === 'underline') execCmd = 'underline';

        if (execCmd) {
            const success = document.execCommand(execCmd, false, null);
            return true; 
        }

        return false;
    };

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