const express = require('express');
const path = require('path');
const { sequelize, Scenario, Line, Delta, Checkpoint } = require('./db.js');
const { Op } = require('sequelize');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'writing.html'));
});

let lineLocks = []; 
let charLocks = [];


app.post('/api/scenarios', async (req, res) => {
    try {
        const title = req.body.title || "Neimenovani scenarij";
        const newScenario = await Scenario.create({ title });
        
        await Line.create({
            lineId: 1,
            text: "",
            nextLineId: null,
            scenarioId: newScenario.id
        });

        res.status(200).json({
            id: newScenario.id,
            title: newScenario.title,
            content: [{ lineId: 1, nextLineId: null, text: "" }]
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


app.get('/api/scenarios/:scenarioId', async (req, res) => {
    try {
        const scenario = await Scenario.findByPk(req.params.scenarioId, {
            include: [Line]
        });

        if (!scenario) return res.status(404).json({ message: "Scenario ne postoji!" });

        const content = scenario.Lines.map(l => ({
            lineId: l.lineId,
            text: l.text,
            nextLineId: l.nextLineId
        })).sort((a, b) => a.lineId - b.lineId);

        res.status(200).json({
            id: scenario.id,
            title: scenario.title,
            content: content
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


app.post('/api/scenarios/:scenarioId/lines/:lineId/lock', async (req, res) => {
    const scenarioId = parseInt(req.params.scenarioId);
    const lineId = parseInt(req.params.lineId);
    const userId = parseInt(req.body.userId);

    try {
        const scenarioExists = await Scenario.findByPk(scenarioId);
        if (!scenarioExists) return res.status(404).json({ message: "Scenario ne postoji!" });

        const line = await Line.findOne({ where: { scenarioId, lineId } });
        if (!line) return res.status(404).json({ message: "Linija ne postoji!" });

        const existingLock = lineLocks.find(l => l.scenarioId === scenarioId && l.lineId === lineId);
        
        if (existingLock && existingLock.userId !== userId) {
            return res.status(409).json({ message: "Linija je vec zakljucana!" });
        }

        lineLocks = lineLocks.filter(l => l.userId !== userId);

        lineLocks.push({ userId, scenarioId, lineId });

        res.status(200).json({ message: "Linija je uspjesno zakljucana!" });
    } catch (err) {
        res.status(500).json({ message: "Greška na serveru" });
    }
});


app.put('/api/scenarios/:scenarioId/lines/:lineId', async (req, res) => {
    const scenarioId = parseInt(req.params.scenarioId);
    const lineId = parseInt(req.params.lineId);
    const userId = parseInt(req.body.userId);
    const { newText } = req.body; 

    if (!newText || !Array.isArray(newText) || newText.length === 0) {
        return res.status(400).json({ message: "Niz new_text ne smije biti prazan!" });
    }

    try {
        const scenarioExists = await Scenario.findByPk(scenarioId);
        if (!scenarioExists) return res.status(404).json({ message: "Scenario ne postoji!" });

        const lock = lineLocks.find(l => l.scenarioId === scenarioId && l.lineId === lineId);
        
        if (lock && lock.userId !== userId) {
            return res.status(409).json({ message: "Linija je vec zakljucana!" });
        }

        const currentLine = await Line.findOne({ where: { scenarioId, lineId } });
        if (!currentLine) return res.status(404).json({ message: "Linija ne postoji!" });
        
        if (!lock) {
            return res.status(409).json({ message: "Linija nije zakljucana!" });
        }

        let processedLines = [];
        newText.forEach(segment => {
            let words = segment.split(/\s+/).filter(w => w !== ""); 
            if (words.length === 0) {
                 
                 processedLines.push(""); 
            } else {
                
                for (let i = 0; i < words.length; i += 20) {
                    processedLines.push(words.slice(i, i + 20).join(" "));
                }
            }
        });
        
        if (processedLines.length === 0) processedLines.push("");

        
        const maxLine = await Line.findOne({ where: { scenarioId }, order: [['lineId', 'DESC']] });
        let nextAvailableId = (maxLine ? maxLine.lineId : 0) + 1;
        
        const originalNextLineId = currentLine.nextLineId; 
        const timestamp = Math.floor(Date.now() / 1000);

        const firstText = processedLines[0];
        const nextIdForFirst = processedLines.length > 1 ? nextAvailableId : originalNextLineId;

        await currentLine.update({ text: firstText, nextLineId: nextIdForFirst });
        
        await Delta.create({
            scenarioId, type: "line_update", lineId, nextLineId: nextIdForFirst, content: firstText, timestamp
        });

        
        let currentNextId = nextAvailableId;
        for (let i = 1; i < processedLines.length; i++) {
            const isLast = i === processedLines.length - 1;
            const thisLineNextId = isLast ? originalNextLineId : (currentNextId + 1);

            await Line.create({ scenarioId, lineId: currentNextId, text: processedLines[i], nextLineId: thisLineNextId });
            
            await Delta.create({
                scenarioId, type: "line_update", lineId: currentNextId, nextLineId: thisLineNextId, content: processedLines[i], timestamp
            });
            currentNextId++;
        }

        
        lineLocks = lineLocks.filter(l => !(l.userId === userId && l.scenarioId === scenarioId && l.lineId === lineId));
        
        res.status(200).json({ message: "Linija je uspjesno azurirana!" });

    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/scenarios/:scenarioId/characters/lock', async (req, res) => {
    const scenarioId = parseInt(req.params.scenarioId);
    const userId = parseInt(req.body.userId);
    const { characterName } = req.body;
    const scenarioExists = await Scenario.findByPk(scenarioId);
    if (!scenarioExists) return res.status(404).json({ message: "Scenario ne postoji!" });

    const existing = charLocks.find(c => c.scenarioId === scenarioId && c.characterName === characterName);
    if (existing && existing.userId !== userId) {
        return res.status(409).json({ message: "Konflikt! Ime lika je vec zakljucano!" });
    }

    if (!existing) {
        charLocks.push({ userId, scenarioId, characterName });
    }
    res.status(200).json({ message: "Ime lika je uspjesno zakljucano!" });
});

app.post('/api/scenarios/:scenarioId/characters/update', async (req, res) => {
    const scenarioId = parseInt(req.params.scenarioId);
    const userId = parseInt(req.body.userId);
    const { oldName, newName } = req.body;

    try {
        
        const scenarioExists = await Scenario.findByPk(scenarioId);
        if (!scenarioExists) return res.status(404).json({ message: "Scenario ne postoji!" });

       
        const lockIndex = charLocks.findIndex(c => c.userId === userId && c.scenarioId === scenarioId && c.characterName === oldName);
        
        if (lockIndex === -1) return res.status(409).json({ message: "Niste zaključali ovo ime!" });

        const lines = await Line.findAll({ where: { scenarioId } });
        const regex = new RegExp(`\\b${oldName}\\b`, 'g'); 

        for (const line of lines) {
            if (regex.test(line.text)) {
                const lineLock = lineLocks.find(l => l.scenarioId === scenarioId && l.lineId === line.lineId && l.userId !== userId);
                if (lineLock) return res.status(409).json({ message: "Konflikt sa zaključanom linijom!" });
            }
        }

        let updatedCount = 0;
        for (const line of lines) {
            if (regex.test(line.text)) {
                const newText = line.text.replace(regex, newName);
                await line.update({ text: newText });
                updatedCount++;
            }
        }

        if(updatedCount > 0) {
            await Delta.create({
                scenarioId, type: "char_rename", oldName, newName, timestamp: Math.floor(Date.now() / 1000)
            });
        }

        charLocks.splice(lockIndex, 1);
        res.status(200).json({ message: "Ime lika je uspjesno promijenjeno!" });

    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/scenarios/:scenarioId/deltas', async (req, res) => {
    const scenarioId = parseInt(req.params.scenarioId);
    const since = parseInt(req.query.since) || 0;

    try {
        const scenarioExists = await Scenario.findByPk(scenarioId);
        if (!scenarioExists) return res.status(404).json({ message: "Scenario ne postoji!" });

        const deltas = await Delta.findAll({
            where: { scenarioId, timestamp: { [Op.gt]: since } },
            order: [['timestamp', 'ASC'], ['id', 'ASC']]
        });

        res.status(200).json({ deltas });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// Checkpoint
app.post('/api/scenarios/:scenarioId/checkpoint', async (req, res) => {
    const scenarioId = parseInt(req.params.scenarioId);
    const scenarioExists = await Scenario.findByPk(scenarioId);
    if (!scenarioExists) return res.status(404).json({ message: "Scenario ne postoji!" });

    await Checkpoint.create({ scenarioId, timestamp: Math.floor(Date.now() / 1000) });
    res.status(200).json({ message: "Checkpoint je uspjesno kreiran!" });
});

// dohvati Checkpointe
app.get('/api/scenarios/:scenarioId/checkpoints', async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId);
        const scenarioExists = await Scenario.findByPk(scenarioId);
        if (!scenarioExists) {
            return res.status(404).json({ message: "Scenario ne postoji!" });
        }

        const checkpoints = await Checkpoint.findAll({ 
            where: { scenarioId },
            attributes: ['id', 'timestamp'] 
        });

        res.status(200).json(checkpoints);
    } catch (error) {
        res.status(500).json({ message: "Greška na serveru", error: error.message });
    }
});

// restore 
app.get('/api/scenarios/:scenarioId/restore/:checkpointId', async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId);
        const checkpointId = parseInt(req.params.checkpointId);
        const scenario = await Scenario.findByPk(scenarioId);
        if (!scenario) {
            return res.status(404).json({ message: "Scenario ne postoji!" });
        }

        const checkpoint = await Checkpoint.findOne({
            where: { 
                id: checkpointId, 
                scenarioId: scenarioId 
            }
        });
        
        if (!checkpoint) {
            return res.status(404).json({ message: "Checkpoint ne postoji!" }); 
        }

        let state = [{ lineId: 1, nextLineId: null, text: "" }];
        
        const deltas = await Delta.findAll({
            where: { 
                scenarioId, 
                timestamp: { [Op.lte]: checkpoint.timestamp }
            },
            order: [['timestamp', 'ASC'], ['id', 'ASC']] 
        });

        deltas.forEach(d => {
            if (d.type === 'line_update') {
                const idx = state.findIndex(l => l.lineId === d.lineId);
              
                const safeText = d.content || ""; 
                const newLine = { lineId: d.lineId, nextLineId: d.nextLineId, text: safeText };
                
                if (idx !== -1) state[idx] = newLine;
                else state.push(newLine);
            } else if (d.type === 'char_rename') {
                const regex = new RegExp(`\\b${d.oldName}\\b`, 'g');
                state.forEach(l => {
                    
                    if (l.text) {
                        l.text = l.text.replace(regex, d.newName);
                    }
                });
            }
        });

       
        state.sort((a, b) => a.lineId - b.lineId);

        
        res.status(200).json({ 
            id: scenario.id, 
            title: scenario.title, 
            lines: state 
        });

    } catch (error) {
        
        res.status(500).json({ message: "Greška na serveru", error: error.message });
    }
});

const initialScenario = {
  id: 1,
  title: "Potraga za izgubljenim ključem",
  lines: [
    { lineId: 1, nextLineId: 2, text: "NARATOR: Sunce je polako zalazilo nad starim gradom." },
    { lineId: 2, nextLineId: 3, text: "ALICIA: Jesi li siguran da je ključ ostao u biblioteci?" },
    { lineId: 3, nextLineId: 23, text: "riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ" },
    { lineId: 23, nextLineId: 24, text: "riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ" },
    { lineId: 24, nextLineId: 21, text: "riječ riječ riječ riječ riječ" },
    { lineId: 21, nextLineId: 22, text: "riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ" },
    { lineId: 22, nextLineId: 19, text: "riječ riječ riječ riječ riječ" },
    { lineId: 19, nextLineId: 20, text: "riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ" },
    { lineId: 20, nextLineId: 17, text: "riječ riječ riječ riječ riječ" },
    { lineId: 17, nextLineId: 18, text: "riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ" },
    { lineId: 18, nextLineId: 15, text: "riječ riječ riječ riječ riječ" },
    { lineId: 15, nextLineId: 16, text: "riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ" },
    { lineId: 16, nextLineId: 13, text: "riječ riječ riječ riječ riječ" },
    { lineId: 13, nextLineId: 14, text: "riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ" },
    { lineId: 14, nextLineId: 11, text: "riječ riječ riječ riječ riječ" },
    { lineId: 11, nextLineId: 12, text: "riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ" },
    { lineId: 12, nextLineId: 9, text: "riječ riječ riječ riječ riječ" },
    { lineId: 9, nextLineId: 10, text: "riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ" },
    { lineId: 10, nextLineId: 7, text: "riječ riječ riječ riječ riječ" },
    { lineId: 7, nextLineId: 8, text: "riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ riječ" },
    { lineId: 8, nextLineId: 4, text: "riječ riječ riječ riječ riječ" },
    { lineId: 4, nextLineId: 5, text: "ALICIA: Moramo požuriti prije nego što čuvar zaključa glavna vrata." },
    { lineId: 5, nextLineId: 6, text: "BOB: Čekaj, čuješ li taj zvuk iza polica?" },
    { lineId: 6, nextLineId: null, text: "NARATOR: Iz sjene se polako pojavila nepoznata figura." }
  ]
};

sequelize.sync({ force: true }).then(async () => {
   
    lineLocks = [];
    charLocks = [];

    try {
        
        const scenario = await Scenario.create({
            id: initialScenario.id, 
            title: initialScenario.title
        });

        
        for (const lineData of initialScenario.lines) {
            await Line.create({
                lineId: lineData.lineId,
                text: lineData.text,
                nextLineId: lineData.nextLineId,
                scenarioId: scenario.id
            });
        }

        console.log("Baza je 'seed-ana' sa testnim podacima.");
    } catch (error) {
        console.error("Greška pri ubacivanju podataka:", error);
    }

    
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });

}).catch(err => console.error("Greška sa bazom:", err));