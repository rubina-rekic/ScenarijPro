let EditorTeksta = function (divRef) {
   
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
            title: null,
            roles: new Map(),
            dialogueSegments: []
        };
        structure.push(currentScene);

        let currentDialogueSegment = null;
        let segmentCounter = 0;
        let replicaIndexInScene = 0;

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

            if (EMPTY_LINE_REGEX.test(line)) continue;

          
            if (SCENE_HEADING_REGEX.test(line)) {
                finishDialogueSegment();
                
                if (structure.length === 1 && !structure[0].title && structure[0].dialogueSegments.length === 0) {
                    structure[0].title = line;
                    currentScene = structure[0];
                } else {
                    currentScene = {
                        title: line,
                        roles: new Map(),
                        dialogueSegments: []
                    };
                    structure.push(currentScene);
                    replicaIndexInScene = 0;
                    segmentCounter = 0;
                }
                continue;
            }

         
            if (ROLE_NAME_REGEX.test(line)) {
                
                let speechStartIndex = i + 1;
                while (speechStartIndex < lines.length && EMPTY_LINE_REGEX.test(lines[speechStartIndex])) {
                    speechStartIndex++;
                }

                if (speechStartIndex < lines.length) {
                    let nextLineRaw = lines[speechStartIndex];
                    let nextTrim = nextLineRaw.trim();

                    if (!SCENE_HEADING_REGEX.test(nextTrim) && !ROLE_NAME_REGEX.test(nextTrim)) {

                        // Skupljamo govor
                        let bufferLines = [];
                        let j = speechStartIndex;

                        while (j < lines.length) {
                            let ln = lines[j].trim();

                            // Prekidi bloka govora:
                            if (EMPTY_LINE_REGEX.test(ln)) break;
                            if (SCENE_HEADING_REGEX.test(ln)) break;
                            if (ROLE_NAME_REGEX.test(ln)) break;

                            bufferLines.push(ln);
                            j++;
                        }

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
                
                finishDialogueSegment();
            }

            else {
                if (!PARENTHETICAL_LINE_REGEX.test(line)) {
                    finishDialogueSegment();
                }
            }
        }
        finishDialogueSegment();
        return structure;
    };

    let dajBrojRijeci = function () {
        const text = editorDiv.innerText || "";
        const allWords = text.split(WORD_SPLIT_REGEX);

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
                while (prev && prev.nodeType !== 3) prev = prev.previousSibling; // Nađi prethodni text node
                if (prev && VALID_WORD_CHECK.test(prev.nodeValue.slice(-1))) {
                    isStartBroken = true;
                }
            }

            if (VALID_WORD_CHECK.test(nodeText.slice(-1))) {
                let next = node.nextSibling;
                while (next && next.nodeType !== 3) next = next.nextSibling; // Nađi sljedeći text node
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
        const targetRole = uloga.toUpperCase();

        let allBlocks = [];
        structure.forEach(scene => {
            scene.dialogueSegments.forEach(segment => {
                segment.blocks.forEach(block => {
                    allBlocks.push({ ...block });
                });
            });
        });

        let mergedBlocks = [];
        if (allBlocks.length > 0) {
            let current = { ...allBlocks[0] };

            for (let i = 1; i < allBlocks.length; i++) {
                const next = allBlocks[i];

                if (
                    next.role === current.role &&
                    next.sceneTitle === current.sceneTitle &&
                    next.segmentId === current.segmentId
                ) {
                    current.replica += "\n" + next.replica;
                } else {
                    mergedBlocks.push(current);
                    current = { ...next };
                }
            }
            mergedBlocks.push(current);
        }

        let indexedBlocks = [];
        let currentSceneTitle = null;
        let sceneReplicaIndex = 0;

        mergedBlocks.forEach(block => {
            if (block.sceneTitle !== currentSceneTitle) {
                currentSceneTitle = block.sceneTitle;
                sceneReplicaIndex = 0;
            }
            sceneReplicaIndex++;
            indexedBlocks.push({
                ...block,
                sceneReplicaIndex
            });
        });

        for (let i = 0; i < indexedBlocks.length; i++) {
            const curr = indexedBlocks[i];

            if (curr.role.toUpperCase() !== targetRole) continue;

            let prevObj = null;
            let nextObj = null;

            if (i > 0) {
                const prev = indexedBlocks[i - 1];
                if (
                    prev.sceneTitle === curr.sceneTitle &&
                    prev.segmentId === curr.segmentId
                ) {
                    prevObj = {
                        uloga: prev.role.toUpperCase(),
                        linije: prev.replica.split('\n')
                    };
                }
            }

            if (i < indexedBlocks.length - 1) {
                const next = indexedBlocks[i + 1];
                if (
                    next.sceneTitle === curr.sceneTitle &&
                    next.segmentId === curr.segmentId
                ) {
                    nextObj = {
                        uloga: next.role.toUpperCase(),
                        linije: next.replica.split('\n')
                    };
                }
            }

            result.push({
                scena: curr.sceneTitle || "SCENE 1",
                pozicijaUTekstu: curr.sceneReplicaIndex,
                prethodni: prevObj,
                trenutni: {
                    uloga: curr.role.toUpperCase(),
                    linije: curr.replica.split('\n')
                },
                sljedeci: nextObj
            });
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