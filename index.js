const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'writing.html'));
});
app.use(express.static(__dirname));

const DATA_DIR = path.join(__dirname, 'data');
const SCENARIOS_DIR = path.join(DATA_DIR, 'scenarios');
const DELTAS_FILE = path.join(DATA_DIR, 'deltas.json');

// In-memory locks (ne perzistiraju se u datotekama)
let lineLocks = []; // { userId, scenarioId, lineId }
let charLocks = []; // { userId, scenarioId, characterName }

// Pomoćna funkcija za čitanje scenarija
async function readScenario(id) {
    try {
        const data = await fs.readFile(path.join(SCENARIOS_DIR, `scenario-${id}.json`), 'utf8');
        return JSON.parse(data);
    } catch (err) { return null; }
}

// Pomoćna funkcija za pisanje scenarija
async function writeScenario(id, scenario) {
    await fs.writeFile(path.join(SCENARIOS_DIR, `scenario-${id}.json`), JSON.stringify(scenario, null, 2));
}

// Ruta: Kreiranje scenarija
app.post('/api/scenarios', async (req, res) => {
    const title = req.body.title || "Neimenovani scenarij";
    const files = await fs.readdir(SCENARIOS_DIR).catch(() => []);

    const ids = files.map(file => {
        const match = file.match(/scenario-(\d+)\.json/);
        return match ? parseInt(match[1]) : 0;
    });

    const id = (ids.length > 0 ? Math.max(...ids) : 0) + 1;

    const newScenario = {
        id: id,
        title: title,
        content: [{ lineId: 1, nextLineId: null, text: "" }]
    };

    await writeScenario(id, newScenario);
    res.status(200).json(newScenario);
});

// Ruta: Zaključavanje linije
// Ruta: Zaključavanje linije (DEBUG VERZIJA)
app.post('/api/scenarios/:scenarioId/lines/:lineId/lock', async (req, res) => {
    // 1. Sve pretvaramo u Integere da budemo sigurni
    const scenarioId = parseInt(req.params.scenarioId);
    const lineId = parseInt(req.params.lineId);
    const userId = parseInt(req.body.userId);

    console.log(`--------------------------------------------------`);
    console.log(`[LOCK POKUŠAJ] UserID: ${userId} --> Želi Scenario: ${scenarioId}, Linija: ${lineId}`);
    console.log(`[TRENUTNI LOCKOVI PRIJE]:`, JSON.stringify(lineLocks));

    const scenario = await readScenario(scenarioId);
    if (!scenario) return res.status(404).json({ message: "Scenario ne postoji!" });

    // Pazi: scenario.content ima lineId kao broj, pa je poređenje sada sigurno (===)
    const line = scenario.content.find(l => l.lineId === lineId);
    if (!line) return res.status(404).json({ message: "Linija ne postoji!" });

    // 2. Provjera da li je neko drugi zaključao
    const existingLock = lineLocks.find(l => l.scenarioId === scenarioId && l.lineId === lineId);

    if (existingLock) {
        console.log(`[PROVJERA] Postoji lock: User ${existingLock.userId}`);
        
        if (existingLock.userId !== userId) {
            console.log(`🛑 ODBIJENO: Lock drži User ${existingLock.userId}, a traži User ${userId}`);
            return res.status(409).json({ message: "Linija je vec zakljucana!" });
        } else {
            console.log(`⚠️ RE-LOCK: Isti korisnik produžava lock.`);
        }
    }

    // 3. Brisanje starih lockova tog korisnika i dodavanje novog
    lineLocks = lineLocks.filter(l => l.userId !== userId);
    lineLocks.push({ userId, scenarioId, lineId });

    console.log(`✅ ODOBRENO. Novi lockovi:`, JSON.stringify(lineLocks));
    res.status(200).json({ message: "Linija je uspjesno zakljucana!" });
});

// Ruta: Update linije (sa wrappingom)
app.put('/api/scenarios/:scenarioId/lines/:lineId', async (req, res) => {
    const { scenarioId, lineId } = req.params;
    const { userId, newText } = req.body;

    if (!newText || !Array.isArray(newText) || newText.length === 0) {
        return res.status(400).json({ message: "Niz new_text ne smije biti prazan!" });
    }

    const scenario = await readScenario(scenarioId);
    if (!scenario) return res.status(404).json({ message: "Scenario ne postoji!" });

    // 1. Provjera locka
    const lockIndex = lineLocks.findIndex(l => l.userId == userId && l.scenarioId == scenarioId && l.lineId == lineId);
    if (lockIndex === -1) return res.status(409).json({ message: "Linija nije zakljucana!" });

    let currentLineIndex = scenario.content.findIndex(l => l.lineId == lineId);
    if (currentLineIndex === -1) return res.status(404).json({ message: "Linija ne postoji!" });

    const originalNextLineId = scenario.content[currentLineIndex].nextLineId;

    // 2. Logika prelamanja (20 riječi) za svaki string u nizu
    let processedLinesTexts = [];
    newText.forEach(textSegment => {
        let words = textSegment.split(/\s+/).filter(w => w !== "");
        if (words.length === 0) {
            processedLinesTexts.push("");
        } else {
            for (let i = 0; i < words.length; i += 20) {
                processedLinesTexts.push(words.slice(i, i + 20).join(" "));
            }
        }
    });

    // 3. Generisanje novih ID-ova i uvezivanje (Linked List)
    let maxId = Math.max(...scenario.content.map(l => l.lineId), 0);
    let newContentParts = processedLinesTexts.map((text, idx) => {
        return {
            lineId: idx === 0 ? parseInt(lineId) : ++maxId,
            text: text,
            nextLineId: null
        };
    });

    // Uvezivanje lanca
    for (let i = 0; i < newContentParts.length - 1; i++) {
        newContentParts[i].nextLineId = newContentParts[i + 1].lineId;
    }
    // Posljednja nova linija pokazuje na ono na šta je stara pokazivala
    newContentParts[newContentParts.length - 1].nextLineId = originalNextLineId;

    // 4. Ažuriranje sadržaja i deltas.json
    scenario.content.splice(currentLineIndex, 1, ...newContentParts);

    const timestamp = Math.floor(Date.now() / 1000);
    const newDeltas = newContentParts.map(lp => ({
        scenarioId: parseInt(scenarioId),
        type: "line_update",
        lineId: lp.lineId,
        nextLineId: lp.nextLineId,
        content: lp.text,
        timestamp: timestamp
    }));

    const deltas = JSON.parse(await fs.readFile(DELTAS_FILE, 'utf8').catch(() => "[]"));
    deltas.push(...newDeltas);
    await fs.writeFile(DELTAS_FILE, JSON.stringify(deltas, null, 2));

    await writeScenario(scenarioId, scenario);
    lineLocks.splice(lockIndex, 1); // Otključaj

    res.status(200).json({ message: "Linija je uspjesno azurirana!" });
});

// Ruta: Dobavljanje specifičnog scenarija
app.get('/api/scenarios/:scenarioId', async (req, res) => {
    const scenario = await readScenario(req.params.scenarioId);
    if (!scenario) return res.status(404).json({ message: "Scenario ne postoji!" });
    res.status(200).json(scenario);
});

// Ruta: Zaključavanje lika
app.post('/api/scenarios/:scenarioId/characters/lock', async (req, res) => {
    const { scenarioId } = req.params;
    const { userId, characterName } = req.body;

    const scenario = await readScenario(scenarioId);
    if (!scenario) return res.status(404).json({ message: "Scenario ne postoji!" });

    const existingLock = charLocks.find(c => c.scenarioId == scenarioId && c.characterName === characterName);
    if (existingLock) return res.status(409).json({ message: "Konflikt! Ime lika je vec zakljucano!" });

    charLocks.push({ userId, scenarioId, characterName });
    res.status(200).json({ message: "Ime lika je uspjesno zakljucano!" });
});

// Ruta: Update imena lika (Globalno u scenariju)
app.post('/api/scenarios/:scenarioId/characters/update', async (req, res) => {
    const { scenarioId } = req.params;
    const { userId, oldName, newName } = req.body;

    const scenario = await readScenario(scenarioId);
    if (!scenario) return res.status(404).json({ message: "Scenario ne postoji!" });

    // Provjera locka
    const lockIndex = charLocks.findIndex(c => c.userId == userId && c.scenarioId == scenarioId && c.characterName === oldName);
    if (lockIndex === -1) return res.status(409).json({ message: "Ime lika nije zakljucano!" });

    // Zamjena imena (case-sensitive) u svim linijama
    scenario.content.forEach(line => {
        line.text = line.text.split(oldName).join(newName);
    });

    // Spasi u deltas
    const delta = {
        scenarioId: parseInt(scenarioId),
        type: "char_rename",
        oldName, newName,
        timestamp: Math.floor(Date.now() / 1000)
    };
    const deltas = JSON.parse(await fs.readFile(DELTAS_FILE, 'utf8').catch(() => "[]"));
    deltas.push(delta);
    await fs.writeFile(DELTAS_FILE, JSON.stringify(deltas, null, 2));

    await writeScenario(scenarioId, scenario);
    charLocks.splice(lockIndex, 1); // Otključaj
    res.status(200).json({ message: "Ime lika je uspjesno promijenjeno!" });
});

// Ruta: Deltas (Promjene od timestampa)
app.get('/api/scenarios/:scenarioId/deltas', async (req, res) => {
    const since = parseInt(req.query.since) || 0;
    const scenarioId = parseInt(req.params.scenarioId);

    const scenario = await readScenario(scenarioId);
    if (!scenario) return res.status(404).json({ message: "Scenario ne postoji!" });

    const allDeltas = JSON.parse(await fs.readFile(DELTAS_FILE, 'utf8').catch(() => "[]"));
    const filtered = allDeltas
        .filter(d => d.scenarioId === scenarioId && d.timestamp > since)
        .sort((a, b) => a.timestamp - b.timestamp);

    res.status(200).json({ deltas: filtered });
});


app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));