let EditorTeksta = function (divRef) {
    // --- VALIDACIJA KONSTRUKTORA ---
    if (!(divRef instanceof HTMLElement) || divRef.tagName !== 'DIV') {
        throw new Error("Pogresan tip elementa!");
    }
    if (divRef.getAttribute("contenteditable") !== "true") {
        throw new Error("Neispravan DIV, ne posjeduje contenteditable atribut!");
    }

    const editorDiv = divRef;

    // --- KONSTANTE I REGEX ---
    // Riječ: slova, brojevi (u kontekstu riječi), crtice, apostrofi.
    // Napomena: Zadatak kaže "Brojevi... ne smatraju se riječima".
    const WORD_SPLIT_REGEX = /[\s\.,?!:;]+/g; 
    
    // Regex za validaciju same riječi (mora imati bar jedno slovo, ne smije biti čisti broj)
    // Dozvoljava: "Word", "It's", "Jean-Luc". Ne dozvoljava: "123", "..."
    const VALID_WORD_CHECK = /[a-zA-ZčćžšđČĆŽŠĐ]+/; 

    const EMPTY_LINE_REGEX = /^\s*$/;
    const SCENE_HEADING_REGEX = /^(INT\.|EXT\.)[\w\W]*\s-\s(DAY|NIGHT|AFTERNOON|MORNING|EVENING)\s*$/;
    // Uloga: Samo velika slova i razmaci, mora imati bar jedno slovo.
    const ROLE_NAME_REGEX = /^(?=.*[A-ZČĆŽŠĐ])[A-ZČĆŽŠĐ\s]+$/;
    const PARENTHETICAL_LINE_REGEX = /^\s*\(.+\)\s*$/;

    // --- INTERNI PARSER (Srce modula) ---
    const parseScenarioStructure = () => {
        let content = editorDiv.innerHTML;
        // Normalizacija novih redova
        content = content.replace(/<br\s*\/?>/gi, '\n');
        content = content.replace(/<\/div>/gi, '\n</div>');
        content = content.replace(/<\/p>/gi, '\n</p>');
        
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const rawText = tempDiv.innerText || tempDiv.textContent; 
        const lines = rawText.split('\n');

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
            const originalLine = lines[i]; // Čuvamo original radi indentation ako treba, mada trimamo za logiku

            if (EMPTY_LINE_REGEX.test(originalLine)) {
                 continue;
            }

            
            if (SCENE_HEADING_REGEX.test(line)) {
                finishDialogueSegment();
                // Nova scena
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

            //  POTENCIJALNA ULOGA
            if (ROLE_NAME_REGEX.test(line)) {
               let hasDialogue = false;
                let j = i + 1;
                let bufferLines = []; // Linije govora

                while (j < lines.length) {
                    const nextLine = lines[j];
                    const nextTrim = nextLine.trim();
                    
                    if (SCENE_HEADING_REGEX.test(nextTrim)) break; // Nailazak na scenu prekida
                    if (ROLE_NAME_REGEX.test(nextTrim)) break; 
                    if (EMPTY_LINE_REGEX.test(nextLine)) {
                        break; 
                    }

                    // Ako nije prazna
                    if (!PARENTHETICAL_LINE_REGEX.test(nextTrim)) {
                        
                        hasDialogue = true;
                       
                    }
                    
                    // Dodajemo u buffer (uključujući zagrade, jer su dio bloka, iako se ne računaju u govor)
                    bufferLines.push(nextTrim);
                    j++;
                }

                // Provjera validnosti uloge (mora postojati bar jedna linija koja nije zagrada)
                const containsActualSpeech = bufferLines.some(l => !PARENTHETICAL_LINE_REGEX.test(l));

                if (containsActualSpeech) {
                    // JESTE ULOGA
                    const roleName = line;
                    
                    if (!currentDialogueSegment) {
                        startNewDialogueSegment();
                    }

                    replicaIndexInScene++;
                    
                   const cleanReplicaLines = bufferLines.filter(l => !PARENTHETICAL_LINE_REGEX.test(l));

                    const block = {
                        role: roleName,
                        replica: cleanReplicaLines.join('\n'), // Samo govor
                        sceneTitle: currentScene.title,
                        replicaIndex: replicaIndexInScene,
                        segmentId: currentDialogueSegment.id
                    };

                    currentDialogueSegment.blocks.push(block);

                    // Dodaj u mapu uloga za scenu
                    if (!currentScene.roles.has(roleName)) {
                        currentScene.roles.set(roleName, []);
                    }
                    currentScene.roles.get(roleName).push(block);

                    // Pomjeri glavni brojač 'i' za onoliko koliko smo linija 'pojeli'
                    i = j - 1; 
                    continue;
                }
            }

             if (!PARENTHETICAL_LINE_REGEX.test(line)) {
                // Ovo je akcija. Akcija prekida dijalog segment.
                finishDialogueSegment();
            }
        }
        finishDialogueSegment(); // Zatvori zadnji
        return structure;
    };

    // --- METODE ---

    let dajBrojRijeci = function () {
        let ukupno = 0;
        let boldiranih = 0;
        let italic = 0;

        
        const walker = document.createTreeWalker(editorDiv, NodeFilter.SHOW_TEXT, null, false);
        let node;

        while (node = walker.nextNode()) {
            const text = node.nodeValue;
            if (!text.trim()) continue;

            // Provjera roditelja za stil
            let parent = node.parentElement;
            let isBold = false;
            let isItalic = false;
            
            // Penjemo se do editora da vidimo stilove
            while (parent && parent !== editorDiv) {
                const style = window.getComputedStyle(parent);
                const fontWeight = style.fontWeight;
                const fontStyle = style.fontStyle;

                if (fontWeight === '700' || fontWeight === 'bold' || parseInt(fontWeight) >= 700) isBold = true;
                if (fontStyle === 'italic') isItalic = true;
                parent = parent.parentElement;
            }

            
            
            const wordsInNode = text.split(WORD_SPLIT_REGEX);
            for (let w of wordsInNode) {
                if (VALID_WORD_CHECK.test(w) && !/^\d+$/.test(w)) {
                    
                    if (isBold) boldiranih++; // (Ovo je aproksimacija)
                    if (isItalic) italic++;
                }
            }
        }

        
        const cleanText = editorDiv.innerText || "";
        const allWords = cleanText.split(/[\s\.,?!:;]+/);
        ukupno = allWords.filter(w => VALID_WORD_CHECK.test(w) && !/^\d+$/.test(w)).length;
        
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
            for(let i=0; i<=b.length; i++) matrix[i] = [i];
            for(let j=0; j<=a.length; j++) matrix[0][j] = j;
            for(let i=1; i<=b.length; i++){
                for(let j=1; j<=a.length; j++){
                    if(b.charAt(i-1) == a.charAt(j-1)) matrix[i][j] = matrix[i-1][j-1];
                    else matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, Math.min(matrix[i][j-1] + 1, matrix[i-1][j] + 1));
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
        const targetRole = uloga; // Pretpostavka: parser već vraća uloge onako kako su napisane

     
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

        for (let i = 0; i < allBlocks.length; i++) {
            const curr = allBlocks[i];
         
            if (curr.role.toUpperCase() === targetRole.toUpperCase()) {
                
                let prevObj = null;
                let nextObj = null;

                // PRETHODNI
                if (i > 0) {
                    const prev = allBlocks[i - 1];
                   
                    if (prev.sceneTitle === curr.sceneTitle && prev.segmentId === curr.segmentId) {
                        prevObj = {
                            uloga: prev.role,
                            linije: prev.replica
                        };
                    }
                }

             
                if (i < allBlocks.length - 1) {
                    const next = allBlocks[i + 1];
                   
                    if (next.sceneTitle === curr.sceneTitle && next.segmentId === curr.segmentId) {
                        nextObj = {
                            uloga: next.role,
                            linije: next.replica
                        };
                    }
                }

                result.push({
                    scena: curr.sceneTitle || "Nepoznata scena", // ili null ako je implicitna
                    pozicijaUTekstu: curr.replicaIndex,
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
        // Provjera da li je selekcija unutar editora
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return false;
        
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        
        // Provjera da li je container (ili njegov roditelj ako je text node) unutar editorDiv-a
        let node = container;
        let inside = false;
        while (node) {
            if (node === editorDiv) {
                inside = true;
                break;
            }
            node = node.parentNode;
        }

        if (!inside) return false;
        if (selection.toString().length === 0) return false; // Nema selektovanog teksta

        // Mapiranje komandi na execCommand
        let execCmd = null;
        if (komanda === 'bold') execCmd = 'bold';
        if (komanda === 'italic') execCmd = 'italic';
        if (komanda === 'underline') execCmd = 'underline';

        if (execCmd) {
            document.execCommand(execCmd, false, null);
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