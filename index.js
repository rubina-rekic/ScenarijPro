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
async function writeScenario(scenario) {
    await fs.writeFile(path.join(SCENARIOS_DIR, `scenario-${scenario.id}.json`), JSON.stringify(scenario, null, 2));
}

// Ruta: Kreiranje scenarija
app.post('/api/scenarios', async (req, res) => {
    const title = req.body.title || "Neimenovani scenarij";
    const files = await fs.readdir(SCENARIOS_DIR).catch(() => []);
    const id = files.length + 1;
    
    const newScenario = {
        id: id,
        title: title,
        content: [{ lineId: 1, nextLineId: null, text: "" }]
    };
    
    await writeScenario(newScenario);
    res.status(200).json(newScenario);
});

// Ruta: Zaključavanje linije
app.post('/api/scenarios/:scenarioId/lines/:lineId/lock', async (req, res) => {
    const { scenarioId, lineId } = req.params;
    const { userId } = req.body;
    
    const scenario = await readScenario(scenarioId);
    if (!scenario) return res.status(404).json({ message: "Scenario ne postoji!" });
    
    const line = scenario.content.find(l => l.lineId == lineId);
    if (!line) return res.status(404).json({ message: "Linija ne postoji!" });

    // Provjera da li je neko drugi zaključao
    const existingLock = lineLocks.find(l => l.scenarioId == scenarioId && l.lineId == lineId);
    if (existingLock && existingLock.userId != userId) {
        return res.status(409).json({ message: "Linija je vec zakljucana!" });
    }

    // Svaki korisnik može imati samo jedan lock globalno - brišemo stare lockove ovog usera
    lineLocks = lineLocks.filter(l => l.userId != userId);
    lineLocks.push({ userId, scenarioId, lineId });

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

    const lockIndex = lineLocks.findIndex(l => l.userId == userId && l.scenarioId == scenarioId && l.lineId == lineId);
    if (lockIndex === -1) return res.status(409).json({ message: "Linija nije zakljucana!" });

    let currentLineIndex = scenario.content.findIndex(l => l.lineId == lineId);
    const originalNextLineId = scenario.content[currentLineIndex].nextLineId;

    // Logika za wrapping i nove linije
    let allWords = [];
    newText.forEach(t => allWords.push(...t.split(/\s+/).filter(w => w !== "")));
    
    // Ako su svi stringovi u nizu bili prazni
    if (allWords.length === 0 && newText.every(t => t === "")) allWords = [""];

    let wrappedLines = [];
    for (let i = 0; i < allWords.length; i += 20) {
        wrappedLines.push(allWords.slice(i, i + 20).join(" "));
    }

    // Zamjena trenutne linije i dodavanje novih
    const baseId = Date.now(); // Jednostavan način za unique ID-ove unutar scenarija
    const newContentParts = wrappedLines.map((text, idx) => ({
        lineId: idx === 0 ? parseInt(lineId) : baseId + idx,
        text: text,
        nextLineId: null
    }));

    // Uveži nextLineIds
    for (let i = 0; i < newContentParts.length - 1; i++) {
        newContentParts[i].nextLineId = newContentParts[i+1].lineId;
    }
    newContentParts[newContentParts.length - 1].nextLineId = originalNextLineId;

    // Ubaci u scenario
    scenario.content.splice(currentLineIndex, 1, ...newContentParts);
    
    // Spasi deltas
    const delta = {
        scenarioId: parseInt(scenarioId),
        type: "line_update",
        lineId: parseInt(lineId),
        nextLineId: newContentParts[0].nextLineId,
        content: newContentParts[0].text,
        timestamp: Math.floor(Date.now() / 1000)
    };
    
    const deltas = JSON.parse(await fs.readFile(DELTAS_FILE, 'utf8').catch(() => "[]"));
    deltas.push(delta);
    await fs.writeFile(DELTAS_FILE, JSON.stringify(deltas, null, 2));

    await writeScenario(scenario);
    lineLocks.splice(lockIndex, 1); // Unlock

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

    await writeScenario(scenario);
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